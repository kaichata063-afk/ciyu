<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '../stores/settings'
import { INTEREST_GROUPS, TONES, pickTheme, THEMES, type Tone } from '../themes'
import { extractJSON, generate } from '../llm'
import { styleTagsPrompt } from '../llm/prompts'

const S = useSettings()
const router = useRouter()
const step = ref(0)
const groups = ref<string[]>([])
const items = ref<string[]>([])
const custom = ref('')
const tone = ref<Tone>('cool')
const busy = ref(false)

const groupKeys = Object.keys(INTEREST_GROUPS) as (keyof typeof INTEREST_GROUPS)[]
const visibleItems = computed(() => groupKeys.filter(g => groups.value.includes(g)).flatMap(g => INTEREST_GROUPS[g].items.map(([k, l]) => ({ k, l }))))
const theme = computed(() => pickTheme(items.value))

function toggle(arr: string[], k: string, max: number) {
  const i = arr.indexOf(k)
  if (i >= 0) arr.splice(i, 1)
  else if (arr.length < max) arr.push(k)
}
function next() {
  if (step.value === 0 && groups.value.length === 0) { step.value = 3; return }
  step.value++
}
function goAi() { S.s.interests = [...items.value]; S.s.tone = tone.value; S.s.themeId = theme.value.id; S.s.onboarded = true; router.replace({ path: '/settings', query: { focus: 'ai' } }) }
async function finish() {
  busy.value = true
  let tags: string[] = []
  const key = S.s.apiKeys[S.s.provider]
  if (custom.value.trim() && key) {
    try {
      const txt = await generate({ provider: S.s.provider, apiKey: key, model: S.s.models[S.s.provider], baseUrl: S.s.baseUrls[S.s.provider] }, styleTagsPrompt(custom.value.trim()), { json: S.s.provider !== 'anthropic', maxTokens: 120, temperature: 0.4 })
      tags = (extractJSON<{ tags: string[] }>(txt).tags || []).slice(0, 5)
    } catch { /* 无密钥或失败则忽略，不保存原文 */ }
  }
  S.s.interests = [...items.value]
  S.s.styleTags = tags
  S.s.tone = tone.value
  S.s.themeId = theme.value.id
  S.s.onboarded = true
  custom.value = ''
  busy.value = false
  router.replace('/go')
}
</script>

<template>
  <div class="stack" style="padding-top: 24px">
    <div class="muted small">词屿</div>

    <template v-if="step === 0">
      <h1>先别管英语。</h1>
      <p class="muted">你平时最容易一坐下就停不下来的是——（最多选 2 个）</p>
      <div class="chips">
        <button v-for="g in groupKeys" :key="g" class="chip" :class="{ on: groups.includes(g) }" @click="toggle(groups, g, 2)">{{ INTEREST_GROUPS[g].label }}</button>
        <button class="chip" :class="{ on: groups.length === 0 }" @click="groups = []">都差不多 / 随便来</button>
      </div>
      <button class="btn block" @click="next">下一步</button>
    </template>

    <template v-else-if="step === 1">
      <h1>具体一点？</h1>
      <p class="muted">选 1–2 个你最常碰的类型</p>
      <div class="chips">
        <button v-for="it in visibleItems" :key="it.k" class="chip" :class="{ on: items.includes(it.k) }" @click="toggle(items, it.k, 2)">{{ it.l }}</button>
      </div>
      <button class="btn block" :disabled="items.length === 0" @click="next">下一步</button>
    </template>

    <template v-else-if="step === 2">
      <h1>最近有没有一部让你上头的？</h1>
      <p class="muted">说个名字就行。我们不会照搬它，只是学学它的味儿——名字不会被保存，只留下"风格标签"。</p>
      <input class="spell" style="letter-spacing: 0; font-size: 17px" v-model="custom" placeholder="游戏 / 剧 / 小说都行，可以跳过" maxlength="40" />
      <p v-if="custom && !S.hasKey" class="muted small">（尚未填 API 密钥，这一步暂不会生效；之后可在设置里补上）</p>
      <div class="row">
        <button class="btn ghost" @click="next">跳过</button>
        <button class="btn" style="flex:1" @click="next">下一步</button>
      </div>
    </template>

    <template v-else-if="step === 3">
      <h1>你更喜欢——</h1>
      <div class="chips">
        <button v-for="t in TONES" :key="t.id" class="chip" :class="{ on: tone === t.id }" @click="tone = t.id">{{ t.label }}</button>
      </div>
      <button class="btn block" @click="step = 4">揭晓我的世界</button>
    </template>

    <template v-else>
      <div class="cover pop" :style="{ '--accent': theme.palette.accent, '--accent2': theme.palette.accent2, '--bg2': theme.palette.bg2 }">
        <div class="muted small">你的世界</div>
        <h1 style="font-size: 34px; margin-top: 6px">{{ theme.name }}</h1>
        <p>{{ theme.tagline }}</p>
        <div class="row wrap" style="margin-top: 14px">
          <span v-for="c in theme.characters" :key="c.id" class="chip">{{ c.name }} · {{ c.role }}</span>
        </div>
      </div>
      <p class="muted small">之后随时可以在「世界设置」里换一个世界，进度都会保留。</p>
      <p class="small"><a href="#/settings?focus=ai" style="color: var(--accent)" @click.prevent="goAi">⚡ 已有 DeepSeek / Claude / GPT 密钥？先去填入，剧情按你的口味即时生成 ›</a></p>
      <button class="btn block" :disabled="busy" @click="finish">{{ busy ? '正在铺路…' : theme.terms.start + ' ▶' }}</button>
      <div class="chips">
        <button v-for="t in Object.values(THEMES)" :key="t.id" class="chip sm" :class="{ on: theme.id === t.id }" @click="items = [...t.covers.slice(0, 1)]">{{ t.name }}</button>
      </div>
    </template>
  </div>
</template>
