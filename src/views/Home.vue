<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSettings } from '../stores/settings'
import { chapterOf, countCollected, loadStates, loadWords, nextThreshold, CHAPTER_THRESHOLDS } from '../engine/session'
import { isDue } from '../engine/fsrs'
import { pick } from '../themes'
import type { WordState } from '../types'

const S = useSettings()
const states = ref<Map<string, WordState>>(new Map())
const total = ref(0)
const loading = ref(true)

onMounted(async () => {
  S.touchDay(false)
  const [w, st] = await Promise.all([loadWords(), loadStates()])
  total.value = w.length
  states.value = st
  loading.value = false
})

const collected = computed(() => countCollected(states.value))
const met = computed(() => [...states.value.values()].filter(s => s.reps > 0).length)
const due = computed(() => [...states.value.values()].filter(s => !s.known && isDue(s)).length)
const chapter = computed(() => chapterOf(collected.value))
const nextT = computed(() => nextThreshold(collected.value))
const prevT = computed(() => CHAPTER_THRESHOLDS[chapter.value - 1] ?? 0)
const pct = computed(() => nextT.value ? Math.round(((collected.value - prevT.value) / (nextT.value - prevT.value)) * 100) : 100)
const greet = computed(() => S.s.plainMode ? '今天从这里开始。' : pick(S.theme.characters[0].greet, new Date().getDate()))
const chapterTitle = computed(() => S.s.plainMode ? '' : S.theme.chapters[chapter.value - 1])
const doneToday = computed(() => S.s.segmentsToday > 0)
const providerLabel = computed(() => ({ deepseek: 'DeepSeek', anthropic: 'Claude', openai: 'GPT' } as Record<string, string>)[S.s.provider])
</script>

<template>
  <div class="two-col">
    <div class="stack">
      <div class="row between" style="align-items: flex-start">
        <div>
          <div class="muted small">{{ S.s.plainMode ? '词屿' : S.theme.name }}</div>
          <h1>第 {{ chapter }} {{ S.t('chapter') }}<template v-if="chapterTitle"> — {{ chapterTitle }}</template></h1>
        </div>
        <router-link :to="{ path: '/settings', query: { focus: 'ai' } }" class="chip sm" :class="{ on: S.hasKey }" style="white-space: nowrap; margin-top: 4px">
          {{ S.hasKey ? '● ' + providerLabel : '⚡ 填入 API' }}
        </router-link>
      </div>

      <div class="cover">
        <p class="snippet" style="font-size: 17px; margin: 0 0 16px">{{ greet }}</p>
        <router-link to="/go" class="btn block">{{ doneToday ? S.t('more') : S.t('start') }} ▶</router-link>
        <p v-if="due" class="muted small center" style="margin: 12px 0 0">{{ S.t('due') }}：{{ due }} 位</p>
      </div>

      <router-link v-if="!S.hasKey" :to="{ path: '/settings', query: { focus: 'ai' } }" class="card" style="display:block; border-color: var(--accent)">
        <div class="row between">
          <b>⚡ 有自己的 DeepSeek / Claude / GPT 密钥？</b>
          <span style="color: var(--accent)">去填入 ›</span>
        </div>
        <p class="muted small" style="margin: 6px 0 0">
          填入后，过场与新剧情按你的世界和口味即时生成。不填也能用（内置 15,000 段剧情，免费）。密钥只存本机。
        </p>
      </router-link>

      <div class="row" style="gap: 16px">
        <div class="card" style="flex:1">
          <div class="muted small">{{ S.t('streak') }}</div>
          <div class="big">{{ S.s.streakDays }}</div>
          <div class="muted small" v-if="S.s.streakBest > S.s.streakDays">曾同行 {{ S.s.streakBest }} 天</div>
        </div>
        <div class="card" style="flex:1">
          <div class="muted small">{{ S.t('freeze') }}</div>
          <div class="big">×{{ S.s.leaveTickets }}</div>
          <div class="muted small">每同行 7 天 +1</div>
        </div>
      </div>
    </div>

    <div class="stack">
      <div class="card">
        <div class="row between">
          <h3>{{ S.t('progress') }}</h3>
          <span class="muted small" v-if="nextT">{{ collected }} / {{ nextT }}</span>
          <span class="muted small" v-else>{{ collected }} / {{ total }}</span>
        </div>
        <div class="bar"><i :style="{ width: pct + '%' }"></i></div>
        <p class="muted small" style="margin: 10px 0 0">
          <template v-if="nextT">再{{ S.t('collected') }} {{ nextT - collected }} 位，{{ S.t('unlock') }}第 {{ chapter + 1 }} {{ S.t('chapter') }}<template v-if="!S.s.plainMode">「{{ S.theme.chapters[chapter] }}」</template></template>
          <template v-else>全部章节已{{ S.t('unlock') }}。</template>
        </p>
      </div>

      <div class="card">
        <h3>{{ S.t('vocab') }}</h3>
        <div class="row between"><span class="muted">{{ S.t('known') }}</span><b>{{ collected }}</b></div>
        <div class="row between"><span class="muted">{{ S.t('unknown') }}</span><b>{{ met - collected }}</b></div>
        <div class="row between"><span class="muted">还没见过</span><b>{{ total - met }}</b></div>
      </div>

      <div v-if="S.hasKey" class="card small">
        <div class="row between">
          <span><b style="color: var(--accent)">●</b> AI 剧情已接入 · {{ providerLabel }}</span>
          <router-link :to="{ path: '/settings', query: { focus: 'ai' } }" class="muted">管理 ›</router-link>
        </div>
        <p v-if="!S.s.allowGenerate" class="muted" style="margin: 6px 0 0">即时生成已暂停，当前使用内置剧情。</p>
      </div>
    </div>
  </div>
</template>
