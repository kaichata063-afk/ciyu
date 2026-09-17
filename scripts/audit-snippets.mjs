// 剧情包质量审计：覆盖率、长度分布、角色名残留、抽样打印
// 用法：node scripts/audit-snippets.mjs [--sample 5]
import { readFileSync, existsSync } from 'node:fs'
const sampleN = Number((process.argv.find(a => a.startsWith('--sample=')) || '--sample=3').split('=')[1])
const words = JSON.parse(readFileSync('public/data/words.json', 'utf8'))
const CN_NAME = /[一-鿿]/
let grand = 0
for (const t of ['cyber', 'xian', 'star', 'store']) {
  const p = `data-src/snippets-full/${t}.json`
  if (!existsSync(p)) { console.log(`[${t}] 无文件`); continue }
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const keys = Object.keys(j)
  grand += keys.length
  const byChapter = {}
  const missing = []
  for (const w of words) for (const s of [0, 1, 2]) {
    const k = `${w.id}:${s}`
    byChapter[w.chapter] ??= { have: 0, total: 0 }
    byChapter[w.chapter].total++
    if (j[k]) byChapter[w.chapter].have++; else missing.push(k)
  }
  const lens = keys.map(k => j[k].en.split(/\s+/).length)
  const avg = (lens.reduce((a, b) => a + b, 0) / (lens.length || 1)).toFixed(1)
  const cnInEn = keys.filter(k => CN_NAME.test(j[k].en)).length
  const noLine = keys.filter(k => !j[k].line).length
  const noHook = keys.filter(k => !j[k].hook).length
  console.log(`\n=== [${t}] ${keys.length}/${words.length * 3} 条 | 平均 ${avg} 词 | 英文正文含中文字符 ${cnInEn} | 缺 line ${noLine} | 缺 hook ${noHook}`)
  console.log('  按章覆盖:', Object.entries(byChapter).map(([c, v]) => `ch${c} ${v.have}/${v.total}`).join('  '))
  if (missing.length && missing.length <= 30) console.log('  缺失:', missing.join(' '))
  const pick = keys.filter((_, i) => i % Math.max(1, Math.floor(keys.length / sampleN)) === 0).slice(0, sampleN)
  for (const k of pick) console.log(`  · ${k}: ${j[k].en.slice(0, 140)}…`)
}
console.log(`\n合计 ${grand} 条`)
