import { db, plain } from '../db'
import { gradeFor, isDue, newWordState, retrievability, review } from './fsrs'
import { getSnippets, type ContentCtx } from './content'
import type { Answer, Question, QuestionType, Session, Snippet, Word, WordState } from '../types'

export const CHAPTER_THRESHOLDS = [0, 30, 80, 150, 250, 400, 600]

export function chapterOf(collected: number) {
  let ch = 1
  for (let k = 1; k < CHAPTER_THRESHOLDS.length; k++) if (collected >= CHAPTER_THRESHOLDS[k]) ch = k + 1
  return ch
}
export function nextThreshold(collected: number) {
  for (const t of CHAPTER_THRESHOLDS) if (collected < t) return t
  return null
}

let wordsCache: Word[] | null = null
export async function loadWords(): Promise<Word[]> {
  if (wordsCache) return wordsCache
  const r = await fetch(`${import.meta.env.BASE_URL}data/words.json`)
  wordsCache = await r.json()
  return wordsCache!
}

export async function loadStates(): Promise<Map<string, WordState>> {
  const all = await db.wordStates.toArray()
  return new Map(all.map(s => [s.wordId, s]))
}

export interface Plan {
  newWords: Word[]
  reviewWords: Word[]
}

/** 选词：老朋友（到期，按 R 升序）最多 3 个 + 新面孔补足 pace；新词按 order 且限定在已解锁章节内 */
export function planSession(words: Word[], states: Map<string, WordState>, pace: number, recentAccuracy: number | null): Plan {
  const now = Date.now()
  const due = words
    .filter(w => { const s = states.get(w.id); return s && !s.known && isDue(s, now) })
    .sort((a, b) => retrievability(states.get(a.id)!) - retrievability(states.get(b.id)!))
  let reviewN = Math.min(3, due.length)
  let newN = pace - reviewN
  if (recentAccuracy != null) {
    if (recentAccuracy < 0.6) { reviewN = Math.min(due.length, reviewN + 1); newN = Math.max(1, pace - reviewN - 1) }
    else if (recentAccuracy > 0.95) newN = Math.min(newN + 1, pace)
  }
  // 积压 > 15 → 支线任务：全部老朋友
  if (due.length > 15) { reviewN = pace; newN = 0 }
  const collected = countCollected(states)
  const chapter = chapterOf(collected)
  const fresh = words.filter(w => w.chapter <= chapter && (!states.get(w.id) || states.get(w.id)!.reps === 0) && !states.get(w.id)?.known)
  const newWords = fresh.slice(0, newN)
  // 若当前章节新词耗尽而未达阈值，允许向后借词
  if (newWords.length < newN) {
    const extra = words.filter(w => w.chapter > chapter && !states.get(w.id)).slice(0, newN - newWords.length)
    newWords.push(...extra)
  }
  return { newWords, reviewWords: due.slice(0, reviewN) }
}

export function countCollected(states: Map<string, WordState>) {
  let n = 0
  for (const s of states.values()) if (s.status === 'friend') n++
  return n
}

export function qtypeFor(s: WordState | undefined): QuestionType {
  const r = s ? retrievability(s) : 0
  if (!s || s.reps === 0 || r < 0.6) return 'choice'
  if (r < 0.85) return 'spell'
  return 'fill'
}

export function slotFor(s: WordState | undefined, themeId: string) {
  const seen = s?.scenesSeen.filter(k => k.startsWith(themeId + ':')).length || 0
  return seen % 3
}

/** 组题 */
export async function buildQuestions(plan: Plan, words: Word[], states: Map<string, WordState>, ctx: ContentCtx): Promise<Question[]> {
  const ordered = interleave(plan.newWords, plan.reviewWords)
  const snippets = await getSnippets(ordered, w => slotFor(states.get(w.id), ctx.theme.id), ctx)
  return ordered.map(w => {
    const st = states.get(w.id)
    let qtype = qtypeFor(st)
    const sn = snippets.get(w.id)!
    if (qtype === 'fill' && !sn.line) qtype = 'spell'
    const q: Question = { word: w, snippet: sn, qtype, isReview: plan.reviewWords.includes(w) }
    if (qtype === 'choice') {
      const opts = distractorsCn(w, words)
      const idx = Math.floor(Math.random() * 4)
      opts.splice(idx, 0, shortCn(w))
      q.options = opts; q.answerIndex = idx
    } else if (qtype === 'fill') {
      const opts = distractorsEn(w, words)
      const idx = Math.floor(Math.random() * 4)
      opts.splice(idx, 0, w.word)
      q.options = opts; q.answerIndex = idx
    }
    return q
  })
}

function interleave(a: Word[], b: Word[]) {
  const out: Word[] = []
  const A = [...a], B = [...b]
  while (A.length || B.length) {
    if (A.length) out.push(A.shift()!)
    if (A.length) out.push(A.shift()!)
    if (B.length) out.push(B.shift()!)
  }
  return out
}

export function shortCn(w: Word) {
  return (w.core || w.meanings[0]?.cn || '').split(/[；;]/)[0].slice(0, 12)
}

function distractorsCn(w: Word, all: Word[]) {
  const pool = all.filter(x => x.id !== w.id && Math.abs(x.order - w.order) < 120 && shortCn(x) && shortCn(x) !== shortCn(w))
  return sample(pool, 3).map(shortCn)
}

function distractorsEn(w: Word, all: Word[]) {
  const pool = all.filter(x => x.id !== w.id && (x.word[0] === w.word[0] || Math.abs(x.word.length - w.word.length) <= 1))
  return sample(pool.length >= 3 ? pool : all.filter(x => x.id !== w.id), 3).map(x => x.word)
}

function sample<T>(arr: T[], n: number) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  const out: T[] = []
  const seen = new Set<any>()
  for (const x of a) { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x) } if (out.length === n) break }
  return out
}

export function checkSpell(input: string, w: Word) {
  return input.trim().toLowerCase() === w.word
}

/** 记录作答并更新记忆状态 */
export async function recordAnswer(
  session: Session, q: Question, correct: boolean, hinted: boolean, responseMs: number, states: Map<string, WordState>, themeId: string,
) {
  let st = states.get(q.word.id) || newWordState(q.word.id)
  const before = st.status
  st = review(st, gradeFor(correct, hinted))
  const sceneKey = `${themeId}:${q.snippet.slot}`
  if (!st.scenesSeen.includes(sceneKey)) st.scenesSeen = [...st.scenesSeen, sceneKey]
  if (correct) {
    st.correctScenes = Math.min(st.correctScenes + 1, 9)
    st.status = st.correctScenes >= 3 ? 'friend' : 'met'
  } else {
    st.status = 'lost'
    st.correctScenes = Math.max(0, st.correctScenes - 1)
  }
  states.set(q.word.id, st)
  await db.wordStates.put(plain(st))
  const a: Answer = { sessionId: session.id, wordId: q.word.id, qtype: q.qtype, correct, hinted, responseMs, ts: Date.now(), theme: themeId }
  await db.answers.add(plain(a))
  if (correct && !hinted) session.correctFirst++
  else if (correct) session.correctHint++
  else session.wrong++
  await db.sessions.put(plain(session))
  return { st, promoted: before !== 'friend' && st.status === 'friend' }
}

export async function recentAccuracy(): Promise<number | null> {
  const last = await db.sessions.orderBy('startedAt').reverse().limit(2).toArray()
  const done = last.filter(s => s.completed)
  if (done.length < 2) return null
  const tot = done.reduce((n, s) => n + s.correctFirst + s.correctHint + s.wrong, 0)
  const ok = done.reduce((n, s) => n + s.correctFirst + s.correctHint, 0)
  return tot ? ok / tot : null
}

export function newSession(themeId: string, words: Word[]): Session {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    theme: themeId, startedAt: Date.now(), words: words.map(w => w.id),
    correctFirst: 0, correctHint: 0, wrong: 0, completed: false,
    device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  }
}

export function renderEn(s: Snippet) {
  return s.en.replace(/\*([^*]+)\*/, '<mark>$1</mark>')
}
export function blankEn(s: Snippet, w: Word) {
  return s.en.replace(/\*([^*]+)\*/, (_m, f: string) => `<mark class="blank">${w.word[0]}${'_'.repeat(Math.max(2, f.length - 1))}</mark>`)
}
export function renderLine(s: Snippet) {
  return (s.line || '').replace(/\*([^*]+)\*/, '<mark class="blank">____</mark>')
}
