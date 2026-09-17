// 构建词库：yiyisheh/CET4-vocabulary 词形还原版词频（2021–2025 真题）× CETWords cet4.json 释义
// 产出 public/data/words.json
// 用法：node scripts/build-words.mjs <high_freq_cet4_v2.txt> <high_freq_lemma_df.csv> <cet4.json> [目标词数=1250]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , v2Path, dfPath, cet4Path, targetArg] = process.argv
if (!v2Path || !dfPath || !cet4Path) {
  console.error('usage: node scripts/build-words.mjs <high_freq_cet4_v2.txt> <high_freq_lemma_df.csv> <cet4.json> [target]')
  process.exit(1)
}
const TARGET = Number(targetArg || 1250)

// 1) v2.txt：只用来取"真题原句"例句与音标（按词形原样 key）
const raw = readFileSync(v2Path, 'utf8')
const v2 = new Map()
for (const b of raw.split(/\n(?=\[\d+\] )/)) {
  const m = b.match(/^\[(\d+)\] (\S+)\n/)
  if (!m) continue
  const word = m[2].toLowerCase()
  const uk = (b.match(/英\[([^\]]*)\]/) || [])[1] || ''
  const us = (b.match(/美\[([^\]]*)\]/) || [])[1] || ''
  const exLine = (b.match(/例句: (.*)/) || [])[1] || ''
  const exM = exLine.match(/^(.*?)\(([^()]*)\)\s*$/)
  const example = exM ? { en: exM[1].trim(), cn: exM[2].trim() } : (exLine ? { en: exLine.trim(), cn: '' } : null)
  const meaning = ((b.match(/释义: (.*)/) || [])[1] || '').trim()
  v2.set(word, { uk, us, example, meaning })
}

// 从 "n.一段(文章); 通道; 经过." 取第一个义项作为核心义（考试语境优先）
function coreFrom(m) {
  if (!m) return ''
  const first = m.split(/\.\s*(?=(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|aux|modal)\.)/)[0]
  return first.replace(/^(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|aux|modal)\.\s*/, '').replace(/[.。]$/, '').trim()
}

// 2) 词形还原版词频 + DF（主排序依据）
const lemmas = []
for (const line of readFileSync(dfPath, 'utf8').split('\n').slice(1)) {
  const [rank, w, d, tf] = line.split(',')
  if (w) lemmas.push({ rank: Number(rank), word: w.trim().toLowerCase(), df: Number(d), tf: Number(tf) })
}
lemmas.sort((a, b) => a.rank - b.rank)

// 3) CETWords 词典
const cet4 = JSON.parse(readFileSync(cet4Path, 'utf8'))
const dict = new Map()
for (const e of cet4) dict.set(e.word.toLowerCase(), e)

// 4) 剔除：功能词、代词、数字、极基础词（初中水平）
const STOP = new Set(`the a an and or but if of to in on at by for with from as is are was were be been being am
do does did have has had will would shall should can could may might must this that these those it its it's
i you he she we they me him her us them my your his our their not no yes so than then there here what which
who whom whose when where why how all any some each every both few more most other another such only own same
up down out off over under again further once very too also just about into through during before after above
below between one two three four five six seven eight nine ten hundred thousand first second third new old good
bad big small long short high low day time year people way thing man woman say get make go come know think see
take want give use find tell ask work seem feel try leave call keep let begin help show hear play run move like
live believe hold bring happen write provide sit stand lose pay meet include continue set learn change lead
understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider
appear buy wait serve die send expect build stay fall cut reach kill remain mr mrs ms school student teacher
family friend home house room food water city country world life money book word name number question problem
week month hour minute night morning today tomorrow yesterday always never often sometimes usually really much
many little great young early late next last right left because while until since although though even still
yet already ever away back around near far together alone happy sad easy hard fast slow hot cold warm cool light
dark red blue green white black car bus train phone computer music movie game sport team girl boy child children
mother father parent son daughter brother sister nothing something anything everything someone anyone everyone
nobody somebody anybody everybody ok okay hi hello please thank thanks sorry yeah oh well now then also
american america china chinese english britain british europe european london york u s
a b c d e f g h j k l m n o p q r t v w x y z i ii iii iv`.split(/\s+/))

const words = []
for (const l of lemmas) {
  if (words.length >= TARGET) break
  const c = dict.get(l.word)
  if (!c) continue
  if (STOP.has(l.word)) continue
  if (!/^[a-z][a-z-]{1,}$/.test(l.word)) continue
  const v = v2.get(l.word)
  const meanings = (c.meanings || []).map(m => ({ pos: m.pos, cn: m.meaning }))
  const examples = (c.examples || []).slice(0, 2).map(x => ({ en: x.sentence, cn: x.translation }))
  words.push({
    id: l.word,
    word: l.word,
    basic: !c.isCore,
    rank: l.rank,
    freq: l.tf,
    df: l.df,
    uk: (v && v.uk) || (c.phoneticUK || '').replace(/^\/|\/$/g, ''),
    us: (v && v.us) || (c.phoneticUS || '').replace(/^\/|\/$/g, ''),
    core: coreFrom(v && v.meaning) || c.coreMeaning || (meanings[0] && meanings[0].cn) || '',
    meaning: (v && v.meaning) || c.meaning || '',
    meanings,
    exam: (v && v.example) || null,   // 真题原句（少数为上游 DeepSeek 自编）
    examples,
  })
}

// 5) 分章：解锁阈值与 PRD 一致；第 7 章为 600 之后全部
const thresholds = [0, 30, 80, 150, 250, 400, 600]
words.forEach((w, i) => {
  let ch = 1
  for (let k = 1; k < thresholds.length; k++) if (i >= thresholds[k]) ch = k + 1
  w.chapter = ch
  w.order = i + 1
})

const outDir = resolve('public/data')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'words.json'), JSON.stringify(words))
console.log('written words:', words.length, '→ public/data/words.json')
console.log('lemma rank reached:', words.at(-1)?.rank, '| basic:', words.filter(w => w.basic).length, '| with exam sentence:', words.filter(w => w.exam).length)
console.log('chapter sizes:', [1, 2, 3, 4, 5, 6, 7].map(c => words.filter(w => w.chapter === c).length))
console.log('first 40:', words.slice(0, 40).map(w => w.word).join(' '))
console.log('600-640:', words.slice(600, 640).map(w => w.word).join(' '))
console.log('last 20:', words.slice(-20).map(w => w.word).join(' '))
