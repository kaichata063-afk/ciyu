import Dexie, { type Table } from 'dexie'
import type { Answer, Session, Snippet, WordState } from './types'

export class CiyuDB extends Dexie {
  wordStates!: Table<WordState, string>
  answers!: Table<Answer, number>
  sessions!: Table<Session, string>
  snippets!: Table<Snippet, string>

  constructor() {
    super('ciyu')
    this.version(1).stores({
      wordStates: 'wordId, due, status',
      answers: '++id, sessionId, wordId, ts',
      sessions: 'id, startedAt',
      snippets: 'key, theme, wordId',
    })
  }
}

export const db = new CiyuDB()

/** IndexedDB 不能存 Vue 响应式 Proxy：写入前统一深拷贝为纯对象 */
export function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export async function exportArchive() {
  const [wordStates, answers, sessions, snippets] = await Promise.all([
    db.wordStates.toArray(),
    db.answers.toArray(),
    db.sessions.toArray(),
    db.snippets.filter(s => s.source === 'generated').toArray().catch(() => [] as Snippet[]),
  ])
  const settings = localStorage.getItem('ciyu:settings')
  return {
    app: 'ciyu',
    version: 1,
    exportedAt: Date.now(),
    settings: settings ? JSON.parse(settings) : null,
    wordStates,
    answers,
    sessions,
    snippets,
  }
}

export async function importArchive(data: any) {
  if (!data || data.app !== 'ciyu') throw new Error('不是词屿的存档文件')
  await db.transaction('rw', db.wordStates, db.answers, db.sessions, db.snippets, async () => {
    if (Array.isArray(data.wordStates)) await db.wordStates.bulkPut(data.wordStates)
    if (Array.isArray(data.sessions)) await db.sessions.bulkPut(data.sessions)
    if (Array.isArray(data.snippets)) await db.snippets.bulkPut(data.snippets)
    if (Array.isArray(data.answers)) {
      const cleaned = data.answers.map(({ id: _id, ...rest }: Answer) => rest)
      await db.answers.bulkAdd(cleaned)
    }
  })
  if (data.settings) {
    const cur = JSON.parse(localStorage.getItem('ciyu:settings') || '{}')
    // 不覆盖本机密钥
    const { apiKeys: _k, ...rest } = data.settings
    localStorage.setItem('ciyu:settings', JSON.stringify({ ...cur, ...rest }))
  }
}

export async function wipeAll() {
  await db.delete()
  localStorage.removeItem('ciyu:settings')
  location.reload()
}
