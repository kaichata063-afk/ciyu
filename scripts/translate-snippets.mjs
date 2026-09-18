// 为已生成的剧情片段补"逐句中文"：sentences = [{en, cn, target}]，目标句 cn 留空（界面保留英文）
// 运行：node --experimental-strip-types scripts/translate-snippets.mjs [--theme cyber] [--chapters 1] [--limit N] [--dry]
// 密钥：.env.local 的 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / ANTHROPIC_MODEL（翻译默认用 claude-haiku-4-5，便宜）
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { splitSentences, isTargetSentence } from '../src/engine/text.ts'
import { THEMES } from '../src/themes/index.ts'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? true : arr[i + 1]] : []).filter(Boolean))
loadDotenv('.env.local')
const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.TRANSLATE_MODEL || 'claude-haiku-4-5-20251001'
const BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')
const THEME_IDS = args.theme ? String(args.theme).split(',') : Object.keys(THEMES)
const CHAPTERS = args.chapters ? String(args.chapters).split(',').map(Number) : null
const LIMIT = args.limit ? Number(args.limit) : Infinity
const DRY = !!args.dry
const BATCH = 12               // 每次请求的片段数
const CONCURRENCY = Number(process.env.GEN_CONCURRENCY || 6)
if (!KEY && !DRY) { console.error('缺少 ANTHROPIC_API_KEY'); process.exit(1) }

const words = JSON.parse(readFileSync('public/data/words.json', 'utf8'))
const chapterOf = new Map(words.map(w => [w.id, w.chapter]))
const usage = { in: 0, out: 0 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

function needs(s) {
  if (!s.sentences) return true
  const parts = splitSentences(s.en)
  return s.sentences.length !== parts.length || s.sentences.some((x, i) => x.en !== parts[i] || (!x.target && !x.cn))
}

function prompt(theme, items) {
  const names = theme.characters.map(c => `${c.en} → ${c.name}`).join('，')
  const body = items.map((it, i) => it.parts.map((p, k) => `${i + 1}.${k}:${p.target ? ' (KEEP)' : ''} ${p.en}`).join('\n')).join('\n\n')
  return `你是中英文学翻译。下面是若干英文短剧情片段，句子按「片段号.句号」编号。请把每个不带 (KEEP) 标记的句子翻成自然、有画面感的简体中文（口语化，符合剧情语气，不要直译腔）；带 (KEEP) 的句子跳过、不要输出。
人名对照（英文→中文，译文必须用中文名）：${names}
输出规则（务必严格遵守）：每个需翻译的句子占一行，格式为「片段号.句号: 译文」，编号后紧跟英文冒号加一个空格再写译文。一行一句，不要合并，不要输出 (KEEP) 句，不要代码块或任何解释。示例：
1.0: 雨敲打着窗玻璃。
1.1: 桌上放着一个没有邮票的信封。

${body}`
}

async function call(system, user, maxTokens) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let r
    try {
      r = await fetch(`${BASE}/v1/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.3, system, messages: [{ role: 'user', content: user }] }),
      })
    } catch (e) { await sleep(2000 * (attempt + 1)); continue }   // fetch failed（网络瞬断）→ 重试
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    usage.in += j.usage?.input_tokens || 0; usage.out += j.usage?.output_tokens || 0
    return (j.content || []).map(c => c.text || '').join('')
  }
  throw new Error('retries exhausted')
}
function extractJSON(t) {
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); const b = f ? f[1] : t
  const s = b.search(/[\[{]/), e = Math.max(b.lastIndexOf('}'), b.lastIndexOf(']'))
  return JSON.parse(b.slice(s, e + 1))
}

let done = 0, fail = 0
for (const tid of THEME_IDS) {
  const theme = THEMES[tid]
  const path = `data-src/snippets-full/${tid}.json`
  if (!existsSync(path)) continue
  const j = JSON.parse(readFileSync(path, 'utf8'))
  const todo = Object.entries(j).filter(([k, s]) => (!CHAPTERS || CHAPTERS.includes(chapterOf.get(k.split(':')[0]))) && needs(s)).slice(0, LIMIT)
  console.log(`[${tid}] ${theme.name}: ${todo.length} 段待翻译${DRY ? '（dry-run）' : ''}`)
  if (DRY) continue
  const jobs = []
  for (let i = 0; i < todo.length; i += BATCH) jobs.push(todo.slice(i, i + BATCH))
  let idx = 0
  const save = () => { const tmp = path + '.tmp'; writeFileSync(tmp, JSON.stringify(j)); renameSync(tmp, path) }  // 原子写：被 kill 也不会截断损坏
  const worker = async () => {
    while (idx < jobs.length) {
      const job = jobs[idx++]
      const items = job.map(([k, s]) => ({ k, s, parts: splitSentences(s.en).map(en => ({ en, target: isTargetSentence(en) })) }))
      try {
        const txt = await call('You translate English fiction into vivid, natural Simplified Chinese. Follow the line format exactly: one line per sentence as "片段号.句号: 译文".', prompt(theme, items), 260 * job.length + 200)
        const map = new Map()
        for (const line of txt.split('\n')) {
          const m = line.match(/^\s*(\d+)\.(\d+)\s*[:：\t]\s*(.+?)\s*$/)
          if (m) map.set(`${m[1]}.${m[2]}`, m[3].trim())
        }
        items.forEach((src, i) => {
          const sents = src.parts.map((p, k) => ({ en: p.en, cn: p.target ? '' : (map.get(`${i + 1}.${k}`) || ''), target: p.target }))
          if (sents.some(x => !x.target && !x.cn)) { fail++; return }
          src.s.sentences = sents
          done++
        })
        save()
        if (idx % 10 === 0) console.log(`  ${tid} ${idx}/${jobs.length} 批 | 完成 ${done} 失败 ${fail} | tokens in ${usage.in} out ${usage.out}`)
      } catch (e) { fail += job.length; console.log(`  ✗ batch: ${e.message.slice(0, 120)}`) }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`[${tid}] 完成`)
}
console.log(`\n合计 翻译 ${done} 段，失败 ${fail}；tokens in ${usage.in} / out ${usage.out}`)

function loadDotenv(p) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
}
