// 手工补齐 store 中 12 段顽固失败片段的逐句中文（英文含行内引号/冒号，脚本行格式解析不了）。
// 目标句 cn 留空（界面保留英文）。运行：node --experimental-strip-types scripts/patch-stubborn.mjs
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { splitSentences, isTargetSentence } from '../src/engine/text.ts'

// 每段：key -> 每个非目标句的中文（按 splitSentences 的实际分句顺序，目标句用 null 占位）
const CN = {
  'enjoy:1': ['唐老先生', '——不是我同事，就是个常客——坐在我们店招下一级没淋湿的台阶上，打开一个纸袋。', '他掏出一个热乎乎的肉包，满足地叹了口气。', null, '“别人都待在家里，所以整条街都是我的。”'],
  'scientist:2': ['凌晨两点刚过，一个穿白大褂的男人匆匆走进来，买了三罐能量饮料，把一摞文件摊在小小的窗台上。', '他不停地自言自语念着一串串数字。', null, '没人知道他在研究什么。”'],
  'pet:1': ['老陈', '每晚都牵着他的乌龟慢悠悠地从店门口走过。', '没错，是只乌龟。', '今晚没了路灯，我差点被这小家伙绊倒。', '老陈', '轻轻笑了。', null],
  'global:2': ['林医生在停电时出现了，一如既往地镇定，手里提着一盏电池灯。', '他一声不吭地把灯放在柜台上，打开笔记本电脑。', '“看看新闻，”他说。', null, '全球范围内像这样的停电增加了三成。”', '他笑了笑。', '“这么说，不只是我们这儿。”'],
  'happiness:0': ['老陈', '每晚都来喝一杯热豆浆。', '他总是付得分毫不差，脸上挂着同样安静的微笑。', null, '他走后，我把这句话记了下来。'],
  'round:0': ['店长像战前的将军一样讲解他的计划。', null, '第二轮：培训员工。', '第三轮：实现盈利。”', '他一边说一边掰着手指数。', '我跟着点头，尽管我刚拖完地，腰还酸着。'],
  'birthday:0': ['我在收银台后面发现一个小蛋糕盒，上面贴着张便利贴，写着“请勿触碰”。', null, '我俩谁都没见过那是谁。'],
  'previously:0': ['一位上了年纪的女士走进来，一脸困惑地环顾四周。', '“这地方变了，”她说。', null, '那时候可不一样。”', '店长给她倒了茶，两人聊起了往事。', '我一边打扫一边听着。', '女士对着回忆微笑，随后问：“陈先生', '还是这儿的老板吗？”', '店长的表情僵住了。', '“他去年春天过世了。”'],
  'profession:0': ['凌晨两点，一个西装革履的男人来买咖啡。', '“熬夜？”', '我问。', null, '“我是个医生。”', '我们简短地聊了聊夜班。', '他人似乎很和善。', '他离开时，我注意到他把医院的工牌落在了柜台上。', '我出声喊他，可他已经走了。', '工牌上的名字写着：林', '医生。'],
  'authority:1': ['店长叉着手站在外面的人行道上，打量着隔壁那间空铺。', '一名市里的稽查员拿着写字板走来，问谁是负责人。', null, '尽管问吧。”', '稽查员笑了笑，开始记录。'],
  'direct:1': ['店长站在人行道上，拿着一张市区地图和一杯咖啡，琢磨着从我们店到三个街区外那处可能的新址之间最快的路线。', null, '搞定。”'],
  'purpose:2': ['临近下班，我在收银台背面发现一张便利贴。', null, '你也一样。”', '那字迹看着像是店长的。', '我读了三遍，把它塞进围裙口袋，莫名觉得，无论新店会带来什么，我都准备好了。'],
}

const path = 'data-src/snippets-full/store.json'
const j = JSON.parse(readFileSync(path, 'utf8'))
let patched = 0, skip = 0
for (const [key, cnList] of Object.entries(CN)) {
  const s = j[key]
  if (!s) { console.log('缺片段', key); continue }
  const parts = splitSentences(s.en)
  if (parts.length !== cnList.length) { console.log('✗ 句数不符', key, parts.length, 'vs', cnList.length); skip++; continue }
  const sentences = parts.map((p, i) => {
    const target = isTargetSentence(p)
    return { en: p, cn: target ? '' : String(cnList[i] || '').trim(), target }
  })
  // 校验：非目标句必须有中文
  if (sentences.some(x => !x.target && !x.cn)) { console.log('✗ 有空译', key); skip++; continue }
  // 校验：恰好 1 目标句
  if (sentences.filter(x => x.target).length !== 1) { console.log('✗ 目标句数异常', key); skip++; continue }
  s.sentences = sentences
  patched++
}
const tmp = path + '.tmp'
writeFileSync(tmp, JSON.stringify(j))
renameSync(tmp, path)
console.log(`补齐 ${patched} 段，跳过 ${skip} 段`)
