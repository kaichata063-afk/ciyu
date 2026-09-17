// 构建期批量预生成剧情片段 → data-src/snippets-full/{theme}.json（整包，再由 split-snippets 拆到 public/data/snippets/{theme}/chN.json）
// 运行：node --experimental-strip-types scripts/gen-snippets.mjs [--theme cyber] [--chapters 1,2] [--slots 0,1,2] [--limit N] [--dry]
// 密钥：读 .env.local 里的 ANTHROPIC_API_KEY（或环境变量）。可选 ANTHROPIC_MODEL（默认 claude-sonnet-4-6）。
// 幂等：已存在且校验通过的 key 会跳过，可随时中断后续跑。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { THEMES, TONES } from '../src/themes/index.ts'

// ---------- 参数 ----------
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? true : arr[i + 1]] : []).filter(Boolean))
loadDotenv('.env.local')
const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
const BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')
const THEME_IDS = args.theme ? String(args.theme).split(',') : Object.keys(THEMES)
const CHAPTERS = args.chapters ? String(args.chapters).split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7]
const SLOTS = args.slots ? String(args.slots).split(',').map(Number) : [0, 1, 2]
const LIMIT = args.limit ? Number(args.limit) : Infinity
const DRY = !!args.dry
const BATCH = 8            // 每次请求的词数
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY || 6)
if (!KEY && !DRY) { console.error('缺少 ANTHROPIC_API_KEY（放在 .env.local 或环境变量）'); process.exit(1) }

const words = JSON.parse(readFileSync('public/data/words.json', 'utf8'))
mkdirSync('data-src/snippets-full', { recursive: true })

// ---------- Prompt（与 src/llm/prompts.ts 保持一致；构建期用 "cool" 中性口味，运行时再按用户口味即时点缀） ----------
function systemPrompt(theme) {
  const toneEn = TONES.find(t => t.id === 'cool')?.en || 'engaging'
  const chars = theme.characters.map(c => `${c.en} (${c.role})`).join(', ')
  return `You write short English interactive-fiction snippets for Chinese university students preparing for CET-4.
World: ${theme.premise}
Tone: ${theme.tone}; overall flavour: ${toneEn}.
Characters (use ONLY these English names in the prose): ${chars}.
Hard rules:
- Use only common English (CET-4 top-3000 words) except the target words.
- Never mention any real-world work of fiction, brand, celebrity or real person.
- Keep every snippet self-contained; no violence beyond mild peril; no romance beyond light warmth.
- Output valid JSON only, no markdown fences. Inside JSON strings use single quotes for dialogue, never unescaped double quotes.`
}
function snippetsPrompt(ws, slot, chapterTitle) {
  const list = ws.map(w => `- "${w.word}" (${w.meanings[0]?.pos || ''} ${w.core})`).join('\n')
  const sceneHint = ['an indoor scene', 'an outdoor / street scene', 'a scene involving a message, object or discovery'][slot]
  return `Chapter: ${chapterTitle}. Scene slot: ${slot} (${sceneHint}; must differ in location and event from other slots).
For EACH target word below, write one snippet.

${list}

Requirements per snippet:
1. "en": 40–60 words of story, containing the target word exactly once, wrapped in asterisks like *word* (inflected forms allowed: *words*, *worked*). The sentence with the target word must be essential to understanding the scene, and the context must make the meaning inferable.
2. "cn_hint": one short Chinese sentence hinting at what happens, WITHOUT translating the target word (use ____ for it).
3. "hook": one suspenseful closing sentence in English, ≤ 12 words.
4. "line": one short spoken line (≤ 14 words) by a character that contains the target word exactly once, wrapped in asterisks.
Return JSON: {"items":[{"word":"...","en":"...","cn_hint":"...","hook":"...","line":"..."}]}`
}

// ---------- 校验（与 src/engine/content.ts 一致） ----------
const BANNED = /\b(harry potter|genshin|honkai|naruto|one piece|marvel|disney|netflix|tiktok|douyin|bilibili|iphone|apple inc|google|tencent|zhen ?huan|jin ?yong)\b/i
function inflectionMatch(form, lemma) {
  form = form.toLowerCase().replace(/[^a-z-]/g, '')
  if (form === lemma) return true
  const stems = [lemma, lemma.replace(/e$/, ''), lemma.replace(/y$/, 'i'), lemma + lemma.slice(-1)]
  if (stems.some(st => form.startsWith(st) && /^(s|es|ed|d|ing|er|est|ly|ies|ied|ment|ness|ful|less|al|ic|ive)?$/.test(form.slice(st.length)))) return true
  // 不规则：became/become, chose/choose 等 —— 允许前 3 个字母相同且长度差 ≤ 2 的短词形
  return lemma.length >= 4 && form.length >= 4 && form.slice(0, 3) === lemma.slice(0, 3) && Math.abs(form.length - lemma.length) <= 2
}
function validate(s, w) {
  if (!s.en || !s.cnHint) return 'empty'
  const marks = s.en.match(/\*[^*]+\*/g) || []
  if (marks.length !== 1) return `marks=${marks.length}`
  if (!inflectionMatch(marks[0].replace(/\*/g, ''), w.word)) return 'wrong-word'
  const n = s.en.split(/\s+/).length
  if (n < 20 || n > 90) return `len=${n}`
  if (BANNED.test(s.en) || BANNED.test(s.cnHint)) return 'banned'
  if (s.line) { const lm = s.line.match(/\*[^*]+\*/g) || []; if (lm.length !== 1 || !inflectionMatch(lm[0].replace(/\*/g, ''), w.word)) s.line = undefined }
  return null
}

// ---------- Anthropic ----------
async function callClaude(system, prompt, maxTokens) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.8, system, messages: [{ role: 'user', content: prompt }] }),
    })
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const j = await r.json()
    usage.in += j.usage?.input_tokens || 0; usage.out += j.usage?.output_tokens || 0
    return (j.content || []).map(c => c.text || '').join('')
  }
  throw new Error('rate limited / server error after retries')
}
function extractJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : text
  const start = body.search(/[\[{]/); const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'))
  const raw = body.slice(start, end + 1)
  try { return JSON.parse(raw) } catch { /* fall through */ }
  // 兜底：逐 item 用正则抽字段（容忍字符串内未转义的双引号）
  const items = []
  const FIELDS = ['word', 'en', 'cn_hint', 'hook', 'line']
  for (const im of raw.split(/\}\s*,\s*\{/)) {
    const o = {}
    for (const f of FIELDS) {
      const re = new RegExp('"' + f + '"\\s*:\\s*"([\\s\\S]*?)"\\s*(?=,\\s*"(?:' + FIELDS.join('|') + ')"\\s*:|\\s*\\}|\\s*$)')
      const fm = im.match(re)
      if (fm) o[f] = fm[1].replace(/\\"/g, '"')
    }
    if (o.word && o.en) items.push(o)
  }
  if (items.length) return { items }
  throw new Error('unparseable JSON')
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const usage = { in: 0, out: 0 }

// ---------- 主流程 ----------
let totalDone = 0, totalFail = 0
for (const tid of THEME_IDS) {
  const theme = THEMES[tid]
  if (!theme) { console.error('unknown theme', tid); continue }
  const outPath = `data-src/snippets-full/${tid}.json`
  const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {}
  const jobs = []
  for (const ch of CHAPTERS) {
    const ws = words.filter(w => w.chapter === ch)
    for (const slot of SLOTS) {
      const todo = ws.filter(w => { const k = `${w.id}:${slot}`; return !(out[k] && !validate(out[k], w)) })
      for (let i = 0; i < todo.length; i += BATCH) jobs.push({ ch, slot, batch: todo.slice(i, i + BATCH) })
    }
  }
  const limited = jobs.slice(0, Number.isFinite(LIMIT) ? Math.ceil(LIMIT / BATCH) : undefined)
  console.log(`[${tid}] ${theme.name}: ${jobs.length} 批待生成（已跳过已完成项）${DRY ? '，dry-run 不调用' : ''}`)
  if (DRY) continue
  let idx = 0
  const save = () => writeFileSync(outPath, JSON.stringify(out))
  const worker = async () => {
    while (idx < limited.length) {
      const job = limited[idx++]
      const title = theme.chapters[job.ch - 1]
      try {
        const txt = await callClaude(systemPrompt(theme), snippetsPrompt(job.batch, job.slot, title), 320 * job.batch.length + 200)
        const j = extractJSON(txt)
        let ok = 0
        for (const it of j.items || []) {
          const w = job.batch.find(x => x.id === String(it.word || '').toLowerCase().trim())
          if (!w) continue
          const s = { en: String(it.en || ''), cnHint: String(it.cn_hint || it.cnHint || ''), hook: String(it.hook || ''), line: it.line ? String(it.line) : undefined, aigc: { provider: 'anthropic', model: MODEL, generatedAt: Date.now() } }
          const err = validate(s, w)
          if (err) { totalFail++; console.log(`  ✗ ${w.word}@${job.slot} ${err}`); continue }
          out[`${w.id}:${job.slot}`] = s; ok++; totalDone++
        }
        save()
        console.log(`  ch${job.ch} slot${job.slot} ${job.batch.map(w => w.word).join(',')} → ${ok}/${job.batch.length}  (tokens in ${usage.in} / out ${usage.out})`)
      } catch (e) {
        totalFail += job.batch.length
        console.log(`  ✗ batch failed ch${job.ch} slot${job.slot}: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`[${tid}] 完成，共 ${Object.keys(out).length} 条 → ${outPath}`)
}
console.log(`\n合计 生成 ${totalDone} 条，失败 ${totalFail} 条；tokens in ${usage.in} / out ${usage.out}`)

function loadDotenv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
