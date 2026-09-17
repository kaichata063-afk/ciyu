// 修复已生成剧情包：cnHint 中的英文角色名 → 中文名
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { THEMES } from '../src/themes/index.ts'
let total = 0
for (const [tid, theme] of Object.entries(THEMES)) {
  const p = `data-src/snippets-full/${tid}.json`
  if (!existsSync(p)) continue
  const j = JSON.parse(readFileSync(p, 'utf8'))
  let n = 0
  for (const s of Object.values(j)) {
    let cn = s.cnHint
    for (const c of theme.characters) {
      if (cn.includes(c.en)) { cn = cn.split(c.en).join(c.name); n++ }
    }
    // 英文名与中文之间的空格清理
    s.cnHint = cn.replace(/([一-鿿])\s+([一-鿿])/g, '$1$2')
  }
  writeFileSync(p, JSON.stringify(j)); total += n
  console.log(`[${tid}] 替换 ${n} 处`)
}
console.log('合计', total)
