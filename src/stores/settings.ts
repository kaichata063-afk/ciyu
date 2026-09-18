import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { THEMES, PLAIN_TERMS, type TermKey, type Tone } from '../themes'

export type Provider = 'deepseek' | 'openai' | 'anthropic'

export interface Settings {
  onboarded: boolean
  themeId: string
  tone: Tone
  interests: string[]
  styleTags: string[]        // 自定义作品名转出的风格标签（不存原文）
  pace: 4 | 6 | 8
  plainMode: boolean
  sound: boolean
  provider: Provider
  apiKeys: Partial<Record<Provider, string>>
  models: Partial<Record<Provider, string>>
  baseUrls: Partial<Record<Provider, string>>
  allowGenerate: boolean     // 允许用我的密钥按需生成剧情
  preferFresh: boolean       // 有密钥时，词片段也优先即时生成（而非内置包）
  streakDays: number
  streakBest: number
  leaveTickets: number
  lastActiveDate: string     // YYYY-MM-DD
  lastTicketGrantStreak: number
  segmentsToday: number
  segmentsDate: string
  createdAt: number
}

const KEY = 'ciyu:settings'

const DEFAULTS: Settings = {
  onboarded: false,
  themeId: 'cyber',
  tone: 'cool',
  interests: [],
  styleTags: [],
  pace: 6,
  plainMode: false,
  sound: true,
  provider: 'deepseek',
  apiKeys: {},
  models: {},
  baseUrls: {},
  allowGenerate: true,
  preferFresh: false,
  streakDays: 0,
  streakBest: 0,
  leaveTickets: 1,
  lastActiveDate: '',
  lastTicketGrantStreak: 0,
  segmentsToday: 0,
  segmentsDate: '',
  createdAt: Date.now(),
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-6',
}
export const DEFAULT_BASE_URLS: Record<Provider, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

export function today(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useSettings = defineStore('settings', () => {
  const saved = localStorage.getItem(KEY)
  const s = ref<Settings>({ ...DEFAULTS, ...(saved ? JSON.parse(saved) : {}) })
  watch(s, v => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true })

  const theme = computed(() => THEMES[s.value.themeId] || THEMES.cyber)
  const t = (k: TermKey) => (s.value.plainMode ? PLAIN_TERMS[k] : theme.value.terms[k])
  const hasKey = computed(() => !!s.value.apiKeys[s.value.provider])
  const canGenerate = computed(() => hasKey.value && s.value.allowGenerate)

  /** 每次打开/完成会话时调用：处理连胜、请假条、跨天 */
  function touchDay(completedSession = false) {
    const d = today()
    if (s.value.lastActiveDate && s.value.lastActiveDate !== d) {
      const gap = daysBetween(s.value.lastActiveDate, d)
      if (gap >= 2) {
        const missed = gap - 1
        if (s.value.leaveTickets >= missed) {
          s.value.leaveTickets -= missed
        } else {
          s.value.streakBest = Math.max(s.value.streakBest, s.value.streakDays)
          s.value.streakDays = 0
        }
      }
    }
    if (s.value.segmentsDate !== d) { s.value.segmentsDate = d; s.value.segmentsToday = 0 }
    if (completedSession) {
      if (s.value.lastActiveDate !== d) {
        s.value.streakDays += 1
        s.value.streakBest = Math.max(s.value.streakBest, s.value.streakDays)
        // 每 7 天发 1 张请假条，上限 2
        if (s.value.streakDays - s.value.lastTicketGrantStreak >= 7 && s.value.leaveTickets < 2) {
          s.value.leaveTickets += 1
          s.value.lastTicketGrantStreak = s.value.streakDays
        }
      }
      s.value.lastActiveDate = d
      s.value.segmentsToday += 1
    }
  }

  return { s, theme, t, hasKey, canGenerate, touchDay }
})

function daysBetween(a: string, b: string) {
  const da = new Date(a + 'T00:00:00'), dbb = new Date(b + 'T00:00:00')
  return Math.round((dbb.getTime() - da.getTime()) / 86400000)
}
