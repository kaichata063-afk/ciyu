import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs'
import type { WordState } from '../types'

// 期望保留率 0.85（低于 Anki 默认 0.9，降低复习堆积；见 PRD 3.4）
const params = generatorParameters({ request_retention: 0.85, enable_fuzz: true })
const scheduler = fsrs(params)

export function newWordState(wordId: string): WordState {
  const c = createEmptyCard(new Date())
  return {
    wordId,
    ...cardToFields(c),
    scenesSeen: [],
    correctScenes: 0,
    status: 'fresh',
  }
}

function cardToFields(c: Card) {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : undefined,
  }
}

function toCard(s: WordState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  }
}

/** 可提取性 R ∈ [0,1]；新词返回 0 */
export function retrievability(s: WordState, now = new Date()): number {
  if (s.reps === 0) return 0
  const r = scheduler.get_retrievability(toCard(s), now, false)
  return Number.isFinite(r) ? r : 0
}

/** 评分映射（PRD 3.4）：一次答对 Good；提示后答对 Hard；两次答错 Again；标记"早就认识" Easy */
export function gradeFor(correct: boolean, hinted: boolean): Grade {
  if (!correct) return Rating.Again
  return hinted ? Rating.Hard : Rating.Good
}

export function review(s: WordState, grade: Grade, now = new Date()): WordState {
  const { card } = scheduler.next(toCard(s), now, grade)
  return { ...s, ...cardToFields(card) }
}

/** 用户标记"早就认识"：直接以 Easy 评两次，给出较长间隔 */
export function markKnown(s: WordState, now = new Date()): WordState {
  let st = review(s, Rating.Easy, now)
  st = review(st, Rating.Easy, new Date(now.getTime() + 60_000))
  return { ...st, known: true, status: 'friend', correctScenes: Math.max(st.correctScenes, 3) }
}

export function isDue(s: WordState, now = Date.now()) {
  return s.reps > 0 && s.due <= now
}
