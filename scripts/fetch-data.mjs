// 下载上游开源数据到 data-src/（构建词库前运行一次）
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('data-src', { recursive: true })
const files = {
  'v2.txt': 'https://raw.githubusercontent.com/yiyisheh/CET4-vocabulary/main/output/high_freq_cet4_v2.txt',
  'lemma_df.csv': 'https://raw.githubusercontent.com/yiyisheh/CET4-vocabulary/main/output/high_freq_lemma_df.csv',
  'cet4.json': 'https://raw.githubusercontent.com/llllli-eng/CETWords/main/data/cet4.json',
  'VOCAB_SOURCE.md': 'https://raw.githubusercontent.com/llllli-eng/CETWords/main/docs/VOCABULARY_SOURCE.md',
}
for (const [name, url] of Object.entries(files)) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`)
  writeFileSync(`data-src/${name}`, Buffer.from(await r.arrayBuffer()))
  console.log('ok', name)
}
