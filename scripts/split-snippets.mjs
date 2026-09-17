// 把 data-src/snippets-full/{theme}.json 按章拆成 public/data/snippets/ {theme}/ch{N}.json，运行时按需加载
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
const words = JSON.parse(readFileSync('public/data/words.json', 'utf8'))
const chapterOf = new Map(words.map(w => [w.id, w.chapter]))
for (const t of ['cyber', 'xian', 'star', 'store']) {
  const p = `data-src/snippets-full/${t}.json`
  if (!existsSync(p)) continue
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const byCh = {}
  for (const [k, v] of Object.entries(j)) {
    const ch = chapterOf.get(k.split(':')[0])
    if (!ch) continue
    ;(byCh[ch] ??= {})[k] = v
  }
  mkdirSync(`public/data/snippets/${t}`, { recursive: true })
  const sizes = []
  for (const [ch, obj] of Object.entries(byCh)) {
    const s = JSON.stringify(obj)
    writeFileSync(`public/data/snippets/${t}/ch${ch}.json`, s)
    sizes.push(`ch${ch}=${(s.length / 1024).toFixed(0)}KB`)
  }
  console.log(`[${t}] ${sizes.join(' ')}`)
}
