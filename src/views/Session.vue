<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '../stores/settings'
import { db, plain } from '../db'
import { pick } from '../themes'
import {
  buildQuestions, chapterOf, countCollected, loadStates, loadWords, newSession, planSession,
  recentAccuracy, recordAnswer, renderEn, blankEn, renderLine, checkSpell, nextThreshold,
} from '../engine/session'
import { extractJSON, generate } from '../llm'
import { chapterScenePrompt, systemPrompt } from '../llm/prompts'
import { markKnown, newWordState } from '../engine/fsrs'
import { localizeNames } from '../engine/content'
import type { Question, Session, WordState } from '../types'
import { playSfx } from '../sfx'

const S = useSettings()
const router = useRouter()

type Phase = 'loading' | 'hook' | 'ask' | 'feedback' | 'scene' | 'done' | 'empty'
const phase = ref<Phase>('loading')
const qs = shallowRef<Question[]>([])
const idx = ref(0)
const q = computed(() => qs.value[idx.value])
const session = shallowRef<Session | null>(null)
const states = shallowRef<Map<string, WordState>>(new Map())
const words = ref<Awaited<ReturnType<typeof loadWords>>>([])

const picked = ref<number | null>(null)
const spell = ref('')
const spellEl = ref<HTMLInputElement | null>(null)
const hinted = ref(false)
const wrongOnce = ref(false)
const lastCorrect = ref(false)
const speech = ref('')
const startedAt = ref(0)
const promoted = ref(false)
const scene = ref<{ en: string; cn: string; hook: string } | null>(null)
const sceneLoading = ref(false)
const genError = ref('')
const showMeaning = ref(false)

const chapter = ref(1)
const chapterTitle = computed(() => S.s.plainMode ? `单元 ${chapter.value}` : S.theme.chapters[chapter.value - 1])
const openHook = ref('')
const llmCfg = computed(() => S.canGenerate ? { provider: S.s.provider, apiKey: S.s.apiKeys[S.s.provider]!, model: S.s.models[S.s.provider], baseUrl: S.s.baseUrls[S.s.provider] } : null)

onMounted(init)

async function init() {
  phase.value = 'loading'
  S.touchDay(false)
  const [w, st] = await Promise.all([loadWords(), loadStates()])
  words.value = w; states.value = st
  chapter.value = chapterOf(countCollected(st))
  const acc = await recentAccuracy()
  const plan = planSession(w, st, S.s.pace, acc)
  const all = [...plan.newWords, ...plan.reviewWords]
  if (!all.length) { phase.value = 'empty'; return }
  session.value = newSession(S.theme.id, all)
  await db.sessions.put(plain(session.value))
  qs.value = await buildQuestions(plan, w, st, {
    theme: S.theme, tone: S.s.tone, styleTags: S.s.styleTags, plain: S.s.plainMode, llm: llmCfg.value, chapterTitle: chapterTitle.value, preferFresh: S.s.preferFresh,
  })
  const last = await db.sessions.orderBy('startedAt').reverse().offset(1).first()
  openHook.value = S.s.plainMode ? '' : (localStorage.getItem('ciyu:lastHook') || pick(S.theme.characters[0].greet, (last?.startedAt || 0) % 7))
  idx.value = 0
  phase.value = 'hook'
}

function begin() { phase.value = 'ask'; resetQ() }
function resetQ() {
  picked.value = null; spell.value = ''; hinted.value = false; wrongOnce.value = false; speech.value = ''; promoted.value = false; showMeaning.value = false
  startedAt.value = performance.now()
  nextTick(() => spellEl.value?.focus())
}

const enHtml = computed(() => {
  if (!q.value) return ''
  if (q.value.qtype === 'spell') return blankEn(q.value.snippet, q.value.word)
  if (q.value.qtype === 'fill') return renderEn(q.value.snippet)
  return renderEn(q.value.snippet)
})
const lineHtml = computed(() => q.value?.qtype === 'fill' ? renderLine(q.value.snippet) : '')

function charSay(kind: 'correct' | 'hint' | 'wrong') {
  if (S.s.plainMode) return kind === 'correct' ? '正确' : kind === 'hint' ? `提示：${q.value.word.core}` : `正确答案：${q.value.word.word} — ${q.value.word.core}`
  const chars = S.theme.characters
  const c = kind === 'hint' ? chars[0] : kind === 'correct' ? chars[Math.random() < 0.7 ? 2 : 1] : chars[Math.random() < 0.6 ? 0 : 2]
  return pick(c[kind])
}

async function choose(i: number) {
  if (phase.value !== 'ask' || picked.value !== null && !wrongOnce.value) return
  const ok = i === q.value.answerIndex
  if (ok) { picked.value = i; await finishQ(true) }
  else if (!wrongOnce.value) { picked.value = i; wrongOnce.value = true; hinted.value = true; speech.value = charSay('hint'); playSfx('hint', S.s.sound) }
  else { picked.value = i; await finishQ(false) }
}
async function submitSpell() {
  if (!spell.value.trim()) return
  const ok = checkSpell(spell.value, q.value.word)
  if (ok) await finishQ(true)
  else if (!wrongOnce.value) { wrongOnce.value = true; hinted.value = true; speech.value = `${charSay('hint')}（${q.value.word.core}）`; spell.value = ''; playSfx('hint', S.s.sound); nextTick(() => spellEl.value?.focus()) }
  else await finishQ(false)
}
function useHint() {
  if (hinted.value) return
  hinted.value = true
  speech.value = q.value.qtype === 'choice' ? charSay('hint') : `${charSay('hint')}（${q.value.word.core}）`
  if (q.value.qtype === 'choice') {
    // 排除一个错误项
    const wrongIdx = (q.value.options || []).map((_, i) => i).filter(i => i !== q.value.answerIndex)
    picked.value = wrongIdx[Math.floor(Math.random() * wrongIdx.length)]
    wrongOnce.value = true
  }
  playSfx('hint', S.s.sound)
}
async function known() {
  // "早就认识"：直接标为老朋友，跳过
  let st = states.value.get(q.value.word.id) || newWordState(q.value.word.id)
  st = markKnown(st)
  states.value.set(q.value.word.id, st)
  await db.wordStates.put(plain(st))
  next()
}
async function finishQ(correct: boolean) {
  lastCorrect.value = correct
  const ms = Math.round(performance.now() - startedAt.value)
  const r = await recordAnswer(session.value!, q.value, correct, hinted.value, ms, states.value, S.theme.id)
  session.value = { ...session.value! }
  states.value = new Map(states.value)
  promoted.value = r.promoted
  speech.value = correct ? charSay('correct') : charSay('wrong')
  showMeaning.value = !correct
  playSfx(correct ? (r.promoted ? 'collect' : 'correct') : 'wrong', S.s.sound)
  phase.value = 'feedback'
}
function next() {
  if (idx.value + 1 < qs.value.length) { idx.value++; phase.value = 'ask'; resetQ() }
  else finishSession()
}

async function finishSession() {
  const s = session.value!
  s.completed = true; s.endedAt = Date.now()
  session.value = { ...s }
  await db.sessions.put(plain(s))
  S.touchDay(true)
  phase.value = 'scene'
  if (S.s.plainMode) return
  sceneLoading.value = true
  scene.value = null
  const ws = qs.value.map(x => x.word)
  if (llmCfg.value) {
    try {
      const txt = await generate(llmCfg.value, chapterScenePrompt(ws, chapterTitle.value, openHook.value), {
        system: systemPrompt(S.theme, S.s.tone, S.s.styleTags), json: llmCfg.value.provider !== 'anthropic', maxTokens: 500,
      })
      const j = extractJSON<{ en: string; cn: string; hook: string }>(txt)
      if (j.en) scene.value = { en: String(j.en), cn: localizeNames(String(j.cn || ''), S.theme), hook: String(j.hook || '') }
    } catch (e) {
      console.warn(e)
      genError.value = String((e as any)?.message || e).slice(0, 120)
    }
  }
  if (!scene.value) {
    // 兜底：把各片段的 hook 串起来
    const hooks = qs.value.map(x => x.snippet.hook).filter(Boolean)
    const ws2 = qs.value.map(x => x.word.word)
    scene.value = {
      en: hooks.length ? hooks.join(' ') : '',
      cn: hooks.length ? '' : `这一段的关键词：${ws2.join(', ')}。${S.theme.characters[2].name}把它们记进了${S.t('archive')}。`,
      hook: pick(S.theme.characters[0].bye),
    }
  }
  localStorage.setItem('ciyu:lastHook', scene.value.hook || '')
  sceneLoading.value = false
}

const stats = computed(() => {
  const s = session.value
  if (!s) return { n: 0, ok: 0, pct: 0, newN: 0, revN: 0 }
  const n = s.correctFirst + s.correctHint + s.wrong
  const ok = s.correctFirst + s.correctHint
  return { n, ok, pct: n ? Math.round((ok / n) * 100) : 0, newN: qs.value.filter(x => !x.isReview).length, revN: qs.value.filter(x => x.isReview).length }
})
const collectedNow = computed(() => countCollected(states.value))
const nextT = computed(() => nextThreshold(collectedNow.value))
const enoughText = computed(() => S.s.segmentsToday >= 3 ? '够了，明天见' : S.t('enough'))
const sceneHtml = computed(() => (scene.value?.en || '').replace(/\*([^*]+)\*/g, '<mark>$1</mark>'))
</script>

<template>
  <div class="session-wrap stack">
    <div v-if="phase === 'loading'" class="center muted" style="padding-top: 30vh">
      <div>正在铺路…</div>
      <div v-if="llmCfg && S.s.preferFresh" class="small" style="margin-top: 8px">{{ S.theme.characters[2].name }}正在为你即时写这一段（约 10–30 秒）</div>
    </div>

    <div v-else-if="phase === 'empty'" class="center stack" style="padding-top: 20vh">
      <h2>今天没有想见你的老朋友，新面孔也都见过了。</h2>
      <p class="muted">明天再来，或者去{{ S.t('nav_contacts') }}里翻翻。</p>
      <router-link to="/" class="btn">回{{ S.t('nav_home') }}</router-link>
    </div>

    <template v-else-if="phase === 'hook'">
      <div class="muted small">第 {{ chapter }} {{ S.t('chapter') }} — {{ chapterTitle }}</div>
      <div class="cover" style="min-height: 40vh; display:flex; flex-direction:column; justify-content:flex-end">
        <p class="snippet" style="font-size: 20px">{{ openHook || '开始吧。' }}</p>
        <p class="muted small">这一段：{{ qs.filter(x => !x.isReview).length }} 位{{ S.t('new_word') }} — {{ qs.filter(x => x.isReview).length }} 位{{ S.t('known') }}</p>
      </div>
      <button class="btn block" @click="begin">{{ S.t('continue') }} ▶</button>
      <router-link to="/" class="muted small center" style="display:block">先不了</router-link>
    </template>

    <template v-else-if="(phase === 'ask' || phase === 'feedback') && q">
      <div class="row between">
        <div class="dots"><i v-for="(_, i) in qs" :key="i" :class="{ done: i < idx, cur: i === idx }"></i></div>
        <span class="muted small">{{ idx + 1 }}/{{ qs.length }} <template v-if="q.isReview">· {{ S.t('review') }}</template></span>
      </div>

      <div class="card rel">
        <span v-if="q.snippet.source !== 'plain'" class="aigc">AI 生成</span>
        <p class="snippet" v-html="enHtml"></p>
        <p v-if="lineHtml && phase === 'ask'" class="snippet" style="margin-top: 12px; font-size: 17px">— <span v-html="lineHtml"></span></p>
        <p class="hint-cn">{{ q.snippet.cnHint }}</p>
        <div v-if="speech" class="speech">{{ speech }}</div>
        <div v-if="showMeaning || (phase === 'feedback' && lastCorrect)" class="hint-cn" style="margin-top: 12px">
          <b style="color: var(--fg)">{{ q.word.word }}</b> <span class="muted">/{{ q.word.us || q.word.uk }}/</span> — {{ q.word.core }}
          <div v-if="q.word.meanings.length > 1" class="small" style="margin-top: 4px">{{ q.word.meanings.map(m => m.pos + ' ' + m.cn).join('　') }}</div>
        </div>
        <p v-if="phase === 'feedback' && lastCorrect && q.snippet.hook" class="hook">{{ q.snippet.hook }}</p>
        <p v-if="phase === 'feedback' && promoted" class="hook pop" style="color: var(--accent); font-style: normal">✦ {{ q.word.word }} 成为{{ S.t('known') }}</p>
      </div>

      <template v-if="phase === 'ask'">
        <div v-if="q.qtype === 'choice' || q.qtype === 'fill'" class="opts">
          <button v-for="(o, i) in q.options" :key="i" class="opt" :class="{ bad: picked === i && i !== q.answerIndex }" :disabled="picked === i && i !== q.answerIndex" @click="choose(i)">{{ o }}</button>
        </div>
        <form v-else class="stack" @submit.prevent="submitSpell">
          <input ref="spellEl" class="spell" v-model="spell" autocomplete="off" autocapitalize="off" spellcheck="false" :placeholder="q.word.word[0] + ' …'" />
          <button class="btn block" type="submit">确定</button>
        </form>
        <div class="row between">
          <button class="btn ghost sm" :disabled="hinted" @click="useHint">🗨 {{ S.t('hint') }}</button>
          <button v-if="!q.isReview" class="btn ghost sm" @click="known">早就认识</button>
        </div>
      </template>

      <template v-else>
        <button class="btn block" @click="next">{{ idx + 1 < qs.length ? S.t('continue') + ' ▸' : '看看这一段的结局 ▸' }}</button>
      </template>
    </template>

    <template v-else-if="phase === 'scene'">
      <div class="muted small center">第 {{ chapter }} {{ S.t('chapter') }} — {{ chapterTitle }}</div>
      <div class="card rel" v-if="!S.s.plainMode">
        <span class="aigc" v-if="scene && llmCfg">AI 生成</span>
        <p v-if="sceneLoading" class="muted center">{{ S.theme.characters[2].name }}正在整理这一段…</p>
        <template v-else-if="scene">
          <p class="snippet" v-if="scene.en" v-html="sceneHtml"></p>
          <p class="hint-cn" v-if="scene.cn">{{ scene.cn }}</p>
          <p class="hook" style="color: var(--fg); opacity: .85">{{ scene.hook }}</p>
        </template>
        <p v-if="genError" class="muted small" style="margin-top: 10px">（AI 生成未成功，已改用内置片段：{{ genError }}）</p>
      </div>
      <router-link v-if="!S.s.plainMode && !S.hasKey" to="/settings" class="card small" style="display:block; border-style: dashed">
        <b>想让这段过场由 AI 按你的世界即时写出来？</b>
        <div class="muted" style="margin-top:4px">在{{ S.t('nav_settings') }}里填入你自己的 DeepSeek / Claude / GPT 密钥即可，密钥只存本机。当前显示的是内置片段串联。</div>
      </router-link>

      <div class="card center">
        <p class="snippet" style="font-size: 17px; margin: 0 0 14px">
          <template v-if="S.s.plainMode">本组完成：{{ stats.ok }} / {{ stats.n }}</template>
          <template v-else>这一段，你靠 {{ stats.newN }} 位{{ S.t('new_word') }}和 {{ stats.revN }} 位{{ S.t('known') }}，读懂了「{{ chapterTitle }}」。</template>
        </p>
        <div class="row between small muted"><span>{{ S.t('accuracy') }}</span><span v-if="S.s.plainMode">{{ stats.pct }}%</span></div>
        <div class="bar" style="margin: 6px 0 14px"><i :style="{ width: stats.pct + '%' }"></i></div>
        <div class="row between small muted"><span>{{ S.t('vocab') }}</span><b style="color: var(--fg)">{{ collectedNow }}</b></div>
        <div class="row between small muted" v-if="nextT"><span>{{ S.t('progress') }}</span><span>{{ collectedNow }} / {{ nextT }}</span></div>
        <div class="row between small muted"><span>{{ S.t('streak') }}</span><b style="color: var(--fg)">{{ S.s.streakDays }}</b></div>
      </div>

      <button class="btn block" @click="router.replace('/')">{{ enoughText }}</button>
      <button class="btn ghost block" v-if="S.s.segmentsToday < 3" @click="init()">{{ S.t('more') }}</button>
      <p v-else class="muted small center">今天已经很够了。{{ S.s.plainMode ? '' : pick(S.theme.characters[0].bye) }}</p>
    </template>
  </div>
</template>
