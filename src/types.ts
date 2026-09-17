export interface Word {
  id: string
  word: string
  basic: boolean
  rank: number
  freq: number
  df: number
  uk: string
  us: string
  core: string
  meaning: string
  meanings: { pos: string; cn: string }[]
  exam: { en: string; cn: string } | null
  examples: { en: string; cn: string }[]
  chapter: number
  order: number
}

export type WordStatus = 'fresh' | 'met' | 'friend' | 'lost'

export interface WordState {
  wordId: string
  // ts-fsrs Card 字段（Date 以时间戳存储）
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: number
  // 业务字段
  scenesSeen: string[]        // 已出现过的场景槽位 key（theme:slot）
  correctScenes: number       // 不同场景下答对次数（≥3 → friend）
  status: WordStatus
  known?: boolean             // 用户标记"早就认识"
}

export type QuestionType = 'choice' | 'spell' | 'fill'

export interface Snippet {
  key: string                 // `${theme}:${wordId}:${slot}`
  theme: string
  wordId: string
  slot: number
  en: string                  // 40–60 词英文片段，目标词以 *word* 标记
  cnHint: string              // 中文提示（不翻译目标词）
  hook: string                // 悬念句
  line?: string               // 台词填词用：含目标词的一句短台词
  source: 'static' | 'generated' | 'plain'
  aigc?: { provider: string; model: string; generatedAt: number }
}

export interface Answer {
  id?: number
  sessionId: string
  wordId: string
  qtype: QuestionType
  correct: boolean
  hinted: boolean
  responseMs: number
  ts: number
  theme: string
}

export interface Session {
  id: string
  theme: string
  startedAt: number
  endedAt?: number
  words: string[]
  correctFirst: number
  correctHint: number
  wrong: number
  completed: boolean
  device: string
}

export interface Question {
  word: Word
  snippet: Snippet
  qtype: QuestionType
  options?: string[]          // choice: 中文义；fill: 英文词
  answerIndex?: number
  isReview: boolean
}
