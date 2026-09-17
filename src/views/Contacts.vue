<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSettings } from '../stores/settings'
import { loadStates, loadWords } from '../engine/session'
import { retrievability } from '../engine/fsrs'
import { db } from '../db'
import type { Snippet, Word, WordState } from '../types'

const S = useSettings()
const words = ref<Word[]>([])
const states = ref<Map<string, WordState>>(new Map())
const tab = ref<'friend' | 'met' | 'lost' | 'all'>('friend')
const qtext = ref('')
const open = ref<Word | null>(null)
const openSnips = ref<Snippet[]>([])

onMounted(async () => {
  const [w, st] = await Promise.all([loadWords(), loadStates()])
  words.value = w; states.value = st
})

const counts = computed(() => {
  let friend = 0, met = 0, lost = 0
  for (const s of states.value.values()) { if (s.status === 'friend') friend++; else if (s.status === 'lost') lost++; else if (s.reps > 0) met++ }
  return { friend, met, lost }
})
const list = computed(() => {
  const qq = qtext.value.trim().toLowerCase()
  return words.value.filter(w => {
    const s = states.value.get(w.id)
    if (qq) return w.word.includes(qq) || w.core.includes(qq)
    if (tab.value === 'all') return true
    if (tab.value === 'friend') return s?.status === 'friend'
    if (tab.value === 'lost') return s?.status === 'lost'
    return s && s.reps > 0 && s.status !== 'friend' && s.status !== 'lost'
  }).slice(0, 300)
})
function dots(w: Word) {
  const s = states.value.get(w.id)
  return Math.min(3, s?.correctScenes || 0)
}
function heat(w: Word) {
  const s = states.value.get(w.id)
  return s && s.reps > 0 ? Math.round(retrievability(s) * 100) : null
}
async function show(w: Word) {
  open.value = w
  openSnips.value = await db.snippets.where('wordId').equals(w.id).toArray()
}
function speak(w: Word) {
  try {
    const u = new SpeechSynthesisUtterance(w.word); u.lang = 'en-US'; u.rate = 0.9
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="stack">
    <div class="row between">
      <h1>{{ S.t('nav_contacts') }}</h1>
      <span class="muted">{{ words.length }}</span>
    </div>
    <input class="spell" style="letter-spacing:0; font-size:16px" v-model="qtext" placeholder="搜单词或释义" />
    <div class="tabs" v-if="!qtext">
      <button class="tab" :class="{ on: tab === 'friend' }" @click="tab = 'friend'">{{ S.t('known') }} {{ counts.friend }}</button>
      <button class="tab" :class="{ on: tab === 'met' }" @click="tab = 'met'">{{ S.t('unknown') }} {{ counts.met }}</button>
      <button class="tab" :class="{ on: tab === 'lost' }" @click="tab = 'lost'">{{ S.t('lost_list') }} {{ counts.lost }}</button>
      <button class="tab" :class="{ on: tab === 'all' }" @click="tab = 'all'">全部</button>
    </div>

    <div class="list">
      <button v-for="w in list" :key="w.id" class="list-item" style="background:none;border:none;border-bottom:1px solid color-mix(in srgb, var(--fg) 7%, transparent);color:inherit;text-align:left" @click="show(w)">
        <div>
          <b>{{ w.word }}</b> <span class="muted small">{{ w.core.split(/[；;]/)[0] }}</span>
        </div>
        <div class="row" style="gap:6px">
          <span v-if="heat(w) !== null" class="muted small">{{ heat(w) }}%</span>
          <span class="dots"><i v-for="k in 3" :key="k" :class="{ done: k <= dots(w) }"></i></span>
        </div>
      </button>
      <p v-if="!list.length" class="muted center" style="padding: 30px 0">这里还空着。</p>
    </div>

    <div v-if="open" class="modal" @click.self="open = null">
      <div class="card stack" style="max-width: 560px; width: 100%; max-height: 85vh; overflow: auto">
        <div class="row between">
          <div>
            <h2 style="margin:0">{{ open.word }} <button class="btn ghost sm" @click="speak(open)">🔊</button></h2>
            <div class="muted small">英 /{{ open.uk }}/ 美 /{{ open.us }}/ — 真题出现 {{ open.freq }} 次 — {{ open.df }} 套卷</div>
          </div>
          <button class="btn ghost sm" @click="open = null">✕</button>
        </div>
        <div><div v-for="m in open.meanings" :key="m.pos + m.cn"><span class="muted">{{ m.pos }}</span> {{ m.cn }}</div></div>
        <div v-if="open.exam" class="card" style="background: var(--bg)">
          <div class="muted small">真题原句</div>
          <div class="snippet" style="font-size: 16px">{{ open.exam.en }}</div>
          <div class="muted small">{{ open.exam.cn }}</div>
        </div>
        <div v-for="e in open.examples" :key="e.en" class="small">
          <div>{{ e.en }}</div><div class="muted">{{ e.cn }}</div>
        </div>
        <div v-if="openSnips.length">
          <div class="muted small">{{ S.t('archive') }}</div>
          <div v-for="s in openSnips" :key="s.key" class="card" style="background: var(--bg); margin-top: 8px">
            <div class="snippet" style="font-size: 15px" v-html="s.en.replace(/\*([^*]+)\*/, '<mark>$1</mark>')"></div>
            <div class="muted small">{{ s.cnHint }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 18px; z-index: 20; }
</style>
