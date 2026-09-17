import { db, plain } from '../db'
import { extractJSON, generate, type LLMConfig } from '../llm'
import { snippetsPrompt, systemPrompt } from '../llm/prompts'
import { pick, type ThemePack, type Tone } from '../themes'
import type { Snippet, Word } from '../types'

const staticCache = new Map<string, Record<string, Snippet>>()

/** 静态预生成包按章拆分：public/data/snippets/{theme}/ch{N}.json → { "word:slot": Snippet }；按需加载并合并 */
async function loadStatic(themeId: string, chapters: number[]) {
  const merged: Record<string, Snippet> = {}
  await Promise.all([...new Set(chapters)].map(async ch => {
    const key = `${themeId}/ch${ch}`
    if (!staticCache.has(key)) {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}data/snippets/${key}.json`, { cache: 'force-cache' })
        staticCache.set(key, r.ok ? await r.json() : {})
      } catch { staticCache.set(key, {}) }
    }
    Object.assign(merged, staticCache.get(key))
  }))
  return merged
}

/** 预取下一章（用户接近解锁阈值时调用，非阻塞） */
export function prefetchChapter(themeId: string, ch: number) {
  void loadStatic(themeId, [ch])
}

export interface ContentCtx {
  theme: ThemePack
  tone: Tone
  styleTags: string[]
  plain: boolean
  llm?: LLMConfig | null
  chapterTitle: string
}

/** 为一组词取片段：IndexedDB 缓存 → 静态包 → 按需生成（有密钥）→ 素颜兜底 */
export async function getSnippets(words: Word[], slotOf: (w: Word) => number, ctx: ContentCtx): Promise<Map<string, Snippet>> {
  const out = new Map<string, Snippet>()
  if (ctx.plain) {
    for (const w of words) out.set(w.id, plainSnippet(w, ctx.theme, slotOf(w), true))
    return out
  }
  const statics = await loadStatic(ctx.theme.id, words.map(w => w.chapter))
  const missing: Word[] = []
  for (const w of words) {
    const slot = slotOf(w)
    const key = `${ctx.theme.id}:${w.id}:${slot}`
    const cached = await db.snippets.get(key)
    if (cached && validate(cached, w)) { out.set(w.id, cached); continue }
    const st = statics[`${w.id}:${slot}`]
    if (st && validate(st, w)) { out.set(w.id, { ...st, cnHint: localizeNames(st.cnHint, ctx.theme), key, theme: ctx.theme.id, wordId: w.id, slot, source: 'static' }); continue }
    missing.push(w)
  }
  if (missing.length && ctx.llm) {
    try {
      const gen = await generateSnippets(missing, slotOf, ctx)
      for (const [id, s] of gen) out.set(id, s)
    } catch (e) {
      console.warn('generate failed, fallback to plain', e)
    }
  }
  for (const w of words) if (!out.has(w.id)) out.set(w.id, plainSnippet(w, ctx.theme, slotOf(w), false))
  return out
}

async function generateSnippets(words: Word[], slotOf: (w: Word) => number, ctx: ContentCtx) {
  const res = new Map<string, Snippet>()
  const slot = slotOf(words[0])
  const text = await generate(ctx.llm!, snippetsPrompt(words, slot, ctx.chapterTitle), {
    system: systemPrompt(ctx.theme, ctx.tone, ctx.styleTags),
    json: ctx.llm!.provider !== 'anthropic',
    maxTokens: 300 * words.length + 200,
  })
  const j = extractJSON<{ items: any[] }>(text)
  const now = Date.now()
  for (const it of j.items || []) {
    const w = words.find(x => x.id === String(it.word || '').toLowerCase().trim())
    if (!w) continue
    const s: Snippet = {
      key: `${ctx.theme.id}:${w.id}:${slotOf(w)}`,
      theme: ctx.theme.id, wordId: w.id, slot: slotOf(w),
      en: String(it.en || ''), cnHint: localizeNames(String(it.cn_hint || it.cnHint || ''), ctx.theme), hook: String(it.hook || ''),
      line: it.line ? String(it.line) : undefined,
      source: 'generated',
      aigc: { provider: ctx.llm!.provider, model: ctx.llm!.model || '', generatedAt: now },
    }
    if (validate(s, w)) {
      await db.snippets.put(plain(s))
      res.set(w.id, s)
    }
  }
  return res
}

/** 中文提示里出现的英文角色名换回中文名 */
export function localizeNames(cn: string, theme: ThemePack) {
  for (const c of theme.characters) if (cn.includes(c.en)) cn = cn.split(c.en).join(c.name)
  return cn.replace(/([一-鿿])\s+([一-鿿])/g, '$1$2')
}

/** 规则校验：目标词出现且被 * 标记恰好一次；长度合理；不含现实作品/品牌黑名单 */
const BANNED = /\b(harry potter|genshin|honkai|naruto|one piece|marvel|disney|netflix|tiktok|douyin|bilibili|iphone|apple inc|google|tencent|zhen ?huan|jin ?yong)\b/i
export function validate(s: Snippet, w: Word): boolean {
  if (!s.en || !s.cnHint) return false
  const marks = s.en.match(/\*[^*]+\*/g) || []
  if (marks.length !== 1) return false
  const marked = marks[0].replace(/\*/g, '').toLowerCase()
  if (!inflectionMatch(marked, w.word)) return false
  const n = s.en.split(/\s+/).length
  if (n < 20 || n > 90) return false
  if (BANNED.test(s.en) || BANNED.test(s.cnHint)) return false
  return true
}

export function inflectionMatch(form: string, lemma: string) {
  form = form.toLowerCase().replace(/[^a-z-]/g, '')
  if (form === lemma) return true
  const stems = [lemma, lemma.replace(/e$/, ''), lemma.replace(/y$/, 'i'), lemma + lemma.slice(-1)]
  return stems.some(st => form.startsWith(st) && /^(s|es|ed|d|ing|er|est|ly|ies|ied)?$/.test(form.slice(st.length)))
}

/** 素颜/兜底片段：真题原句（或词典例句）+ 一句角色引导 */
export function plainSnippet(w: Word, theme: ThemePack, slot: number, plainMode: boolean): Snippet {
  const ex = w.exam || w.examples[0] || { en: `${w.word}.`, cn: w.core }
  const en = markWord(ex.en, w.word)
  const frame = plainMode ? '' : pick(theme.plainFrame, w.order + slot).replace('{name}', theme.characters[slot % 3].name)
  return {
    key: `${theme.id}:${w.id}:${slot}`,
    theme: theme.id, wordId: w.id, slot,
    en,
    cnHint: frame ? `${frame} ${maskCn(ex.cn, w.core)}` : maskCn(ex.cn, w.core),
    hook: '',
    line: undefined,
    source: 'plain',
  }
}

export function markWord(sentence: string, lemma: string) {
  const tokens = sentence.split(/(\s+)/)
  let done = false
  const out = tokens.map(tk => {
    if (done || !tk.trim()) return tk
    const m = tk.match(/^([^A-Za-z-]*)([A-Za-z-]+)([^A-Za-z-]*)$/)
    if (!m) return tk
    if (inflectionMatch(m[2], lemma)) { done = true; return `${m[1]}*${m[2]}*${m[3]}` }
    return tk
  })
  return done ? out.join('') : `*${lemma}* — ${sentence}`
}

function maskCn(cn: string, core: string) {
  if (!cn) return ''
  const first = core.split(/[；;，,、\s(（]/)[0]
  return first && cn.includes(first) ? cn.replace(first, '____') : cn
}
