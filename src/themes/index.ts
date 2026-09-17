export type Tone = 'burn' | 'sweet' | 'cool' | 'suspense' | 'funny'

export interface Character {
  id: 'mentor' | 'rival' | 'ally'
  name: string
  en: string              // 英文正文中使用的名字
  role: string
  // 反馈台词池
  correct: string[]
  hint: string[]
  wrong: string[]
  greet: string[]
  bye: string[]
}

export interface ThemePack {
  id: string
  name: string
  tagline: string
  tags: string[]
  covers: string[]         // 覆盖的兴趣品类 key
  premise: string          // 给大模型的世界设定
  tone: string             // 给大模型的语气
  characters: Character[]
  chapters: string[]       // 7 章标题
  palette: { bg: string; bg2: string; fg: string; accent: string; accent2: string; muted: string }
  motif: string
  terms: Record<TermKey, string>
  // 素颜片段的包装句（当没有生成内容时，用真题例句 + 一句角色引导）
  plainFrame: string[]     // 含 {name}
}

export type TermKey =
  | 'nav_home' | 'nav_contacts' | 'nav_settings'
  | 'start' | 'continue' | 'new_word' | 'unknown' | 'known' | 'review' | 'due'
  | 'test' | 'exam' | 'wrong' | 'lost_list' | 'accuracy' | 'checkin' | 'streak' | 'freeze'
  | 'vocab' | 'daily' | 'curve' | 'progress' | 'example' | 'hint' | 'settings' | 'plain_mode'
  | 'chapter' | 'enough' | 'more' | 'archive' | 'collected' | 'unlock'

// 统一替代（所有主题通用）
export const BASE_TERMS: Record<TermKey, string> = {
  nav_home: '旅程', nav_contacts: '通讯录', nav_settings: '世界设置',
  start: '出发', continue: '继续', new_word: '新面孔', unknown: '还没混熟', known: '老朋友',
  review: '老友回访', due: '想见你的老朋友', test: '试身手', exam: '终局', wrong: '走散了',
  lost_list: '走散名册', accuracy: '默契度', checkin: '今日到场', streak: '同行天数', freeze: '请假条',
  vocab: '通讯录人数', daily: '今日行程', curve: '交情热度', progress: '旅程地图', example: '台词',
  hint: '队友悄悄话', settings: '世界设置', plain_mode: '素颜模式', chapter: '章', enough: '今天够了',
  more: '再来一段', archive: '剧情档案', collected: '收服', unlock: '解锁',
}

// 素颜模式：标准术语
export const PLAIN_TERMS: Record<TermKey, string> = {
  nav_home: '首页', nav_contacts: '词库', nav_settings: '设置',
  start: '开始学习', continue: '继续', new_word: '新词', unknown: '生词', known: '熟词',
  review: '复习', due: '待复习', test: '测试', exam: '考试', wrong: '答错',
  lost_list: '错词本', accuracy: '正确率', checkin: '打卡', streak: '连续天数', freeze: '补签卡',
  vocab: '词汇量', daily: '每日任务', curve: '记忆强度', progress: '进度', example: '例句',
  hint: '提示', settings: '设置', plain_mode: '素颜模式', chapter: '单元', enough: '完成',
  more: '再来一组', archive: '学习记录', collected: '掌握', unlock: '解锁',
}

const cyber: ThemePack = {
  id: 'cyber',
  name: '霓虹裂隙',
  tagline: '2099 年的港湾城，语言是黑客的武器。',
  tags: ['赛博', '悬疑', '群像', '爽'],
  covers: ['g_shooter', 'g_horror', 'n_urban', 'd_crime', 'd_spy', 'd_scifi'],
  premise: 'The year is 2099 in Harbor City, a rain-soaked neon metropolis. Language itself is a hacker\'s weapon: encrypted broadcasts, coded graffiti, forbidden words. The narrator is a rookie investigator who can "hear" hidden signals.',
  tone: 'cold, fast-paced, noir, each scene ends on a cliffhanger',
  characters: [
    { id: 'mentor', name: '灰鸦', en: 'Grey Crow', role: '引路人',
      correct: ['灰鸦点了点头，没说话。', '"还行。"灰鸦把烟掐了。', '灰鸦在终端上敲了个勾。'],
      hint: ['灰鸦：别急，看它前后那两句。', '灰鸦：这词在情报里出现过，想想当时的场景。', '灰鸦：排除最不可能的那个。'],
      wrong: ['灰鸦：信号丢了。记住它，下次它还会来。', '灰鸦：没关系，这条线索我先替你收着。'],
      greet: ['雨还没停。信号也没停。', '灰鸦的消息只有两个字：接单。', '港湾城的夜，从来不安静。'],
      bye: ['灰鸦：今晚到这。别在街上多待。', '灰鸦：情报已归档。明晚同一时间。'] },
    { id: 'rival', name: '零点', en: 'Zero', role: '对手',
      correct: ['零点冷笑："运气不错。"', '零点："这次算你快。"'],
      hint: ['零点："提示？我只说一次——"', '零点："看清楚再选，菜鸟。"'],
      wrong: ['零点："就这？"', '零点："下次别再犯同样的错。"'],
      greet: ['零点在频道里留了一句话：等你。'], bye: ['零点下线了。'] },
    { id: 'ally', name: '阿栗', en: 'Ali', role: '伙伴',
      correct: ['阿栗：反应真快！', '阿栗小声说：漂亮。', '阿栗比了个 OK。'],
      hint: ['阿栗悄悄凑过来：我觉得跟"那个意思"有关……', '阿栗：想想灰鸦刚才说的话。'],
      wrong: ['阿栗：没事，我也第一次听。', '阿栗：走散了没关系，我们再找它。'],
      greet: ['阿栗在破霓虹灯下等你。'], bye: ['阿栗：明天见，别熬夜。'] },
  ],
  chapters: ['雨夜接单', '港湾夜市', '第七频道', '旧城地下', '零点的局', '断电之夜', '终局行动'],
  palette: { bg: '#0B0F1A', bg2: '#141a2b', fg: '#e6f1ff', accent: '#00E5FF', accent2: '#FF2E88', muted: '#7f8aa3' },
  motif: 'neon',
  terms: {
    ...BASE_TERMS,
    nav_home: '旅程', nav_contacts: '线人网络', nav_settings: '终端',
    start: '接单', new_word: '新线人', unknown: '加密中', known: '已解密', review: '复核情报', due: '待复核情报',
    test: '突破封锁', exam: '终局行动', wrong: '信号丢失', lost_list: '失联名单', accuracy: '解密率',
    checkin: '上线', streak: '连线天数', freeze: '断网豁免', vocab: '线人网络', daily: '今日接单量',
    curve: '信号强度', progress: '城区解锁', example: '对白', hint: '灰鸦提示', settings: '终端', plain_mode: '纯文本终端',
    archive: '旧案卷宗', collected: '解密',
  },
  plainFrame: ['{name}递来一张旧卷宗，上面只有一句话：', '终端弹出一条截获的通讯：', '{name}指着墙上褪色的涂鸦：'],
}

const xian: ThemePack = {
  id: 'xian',
  name: '云海问道',
  tagline: '山上的字，每一个都是一味药。',
  tags: ['修仙', '权谋', '燃'],
  covers: ['n_xuanhuan', 'd_costume', 'n_history', 'g_card'],
  premise: 'A cultivation world of floating mountains above a sea of clouds. Words are spiritual herbs and formulas; whoever masters them can heal, fight, or fly. The narrator is a newly admitted disciple of the Cloud Sea Sect.',
  tone: 'poetic, calm but with rising stakes, each scene ends with a sign or omen',
  characters: [
    { id: 'mentor', name: '青梧师尊', en: 'Master Qingwu', role: '师尊',
      correct: ['师尊微微颔首。', '师尊："悟性尚可。"', '师尊拂袖，一片云叶落在你掌心。'],
      hint: ['师尊："观其前后，字义自现。"', '师尊："此字你曾在山门见过。"', '师尊："去其三，留其一。"'],
      wrong: ['师尊："走火了。无妨，再温养。"', '师尊："记下它。下次它自会来寻你。"'],
      greet: ['云海翻涌，晨课将至。', '师尊留下一片竹简，上有今日课业。'],
      bye: ['师尊："今日到此。回洞府静养。"', '暮鼓响了。'] },
    { id: 'rival', name: '沈无咎', en: 'Shen Wujiu', role: '同门师兄',
      correct: ['沈无咎冷哼一声，没再说话。', '沈无咎："侥幸。"'],
      hint: ['沈无咎："我只提一次——看那句偶语。"'],
      wrong: ['沈无咎："就这点悟性？"'],
      greet: ['沈无咎在试剑台等你。'], bye: ['沈无咎负手离去。'] },
    { id: 'ally', name: '小杏', en: 'Xiaoxing', role: '同门师妹',
      correct: ['小杏："师兄好厉害！"', '小杏偷偷给你比了个赞。'],
      hint: ['小杏小声说：我猜跟"那个意思"差不多……', '小杏：想想师尊刚才那句话。'],
      wrong: ['小杏："没事没事，我也不会。"'],
      greet: ['小杏抱着一摞残卷跑来。'], bye: ['小杏："明天一起晨课呀。"'] },
  ],
  chapters: ['入山门', '灵植园', '藏经残卷', '试剑台', '云海之下', '天劫前夜', '飞升'],
  palette: { bg: '#0f1a17', bg2: '#172622', fg: '#eef7f2', accent: '#7ee0b8', accent2: '#e8c872', muted: '#7f9a90' },
  motif: 'ink',
  terms: {
    ...BASE_TERMS,
    nav_home: '修行', nav_contacts: '灵植园', nav_settings: '洞府',
    start: '下山历练', new_word: '新识灵植', unknown: '未参悟', known: '已入册', review: '温养', due: '灵植待浇灌',
    test: '试剑', exam: '飞升', wrong: '走火', lost_list: '待重修录', accuracy: '悟性',
    checkin: '晨课', streak: '闭关日', freeze: '闭关静修', vocab: '灵植园', daily: '今日课业',
    curve: '灵植生长期', progress: '修行地图', example: '偶语', hint: '师尊指点', settings: '洞府', plain_mode: '闭口禅',
    archive: '前辈手记', collected: '入册',
  },
  plainFrame: ['{name}展开一卷前辈手记，其上写着：', '藏经阁的残卷里夹着一行字：', '{name}以指为笔，在云上写下：'],
}

const star: ThemePack = {
  id: 'star',
  name: '星野旅团',
  tagline: '每一个词，都是地图上一个没去过的地方。',
  tags: ['冒险', '开放世界', '治愈', '燃'],
  covers: ['g_openworld', 'g_party', 'g_anime', 'd_fantasy', 'n_infinite', 'n_campus'],
  premise: 'An open-world adventure across floating islands under a sky full of stars. A small travelling troupe collects "words" as map fragments; each word unlocks a new place. The narrator is the troupe\'s newest member.',
  tone: 'warm, curious, light-hearted with moments of wonder, each scene ends with a new horizon',
  characters: [
    { id: 'mentor', name: '老舵', en: 'Old Helm', role: '团长',
      correct: ['老舵："不错，记进航海日志。"', '老舵拍了拍你的肩。'],
      hint: ['老舵："看前后两句，风向就在那儿。"', '老舵："这词咱们在上一个岛见过。"'],
      wrong: ['老舵："迷路了？没事，地图上标一下，回头再来。"'],
      greet: ['风起了。老舵在甲板上喊你的名字。', '今天的航线已经画好了。'],
      bye: ['老舵："落锚。今天就到这。"', '老舵："明天，新的岛。"'] },
    { id: 'rival', name: '银牙', en: 'Silverfang', role: '竞争船长',
      correct: ['银牙远远地举了举杯。', '银牙："这次算你先到。"'],
      hint: ['银牙："给你个方向——别往最显眼的地方看。"'],
      wrong: ['银牙："这块碎片，我先拿走了。"'],
      greet: ['银牙的船出现在地平线上。'], bye: ['银牙的船消失在星光里。'] },
    { id: 'ally', name: '小铃', en: 'Bell', role: '领航员',
      correct: ['小铃："对！就是它！"', '小铃在地图上画了颗星。'],
      hint: ['小铃小声说：我猜跟"那个意思"有关……', '小铃：老舵刚才提过一嘴。'],
      wrong: ['小铃："没关系，我们下次绕回来。"'],
      greet: ['小铃举着地图冲你招手。'], bye: ['小铃："晚安，做个有星星的梦。"'] },
  ],
  chapters: ['起航', '浮岛集市', '灯塔之谜', '风暴海域', '银牙的赌约', '星落之夜', '地图尽头'],
  palette: { bg: '#0d1330', bg2: '#182050', fg: '#f3f4ff', accent: '#ffd166', accent2: '#5ee1ff', muted: '#8b90b8' },
  motif: 'stars',
  terms: {
    ...BASE_TERMS,
    nav_home: '航线', nav_contacts: '航海日志', nav_settings: '船舱',
    start: '起航', new_word: '新地标', unknown: '未探明', known: '已登陆', review: '重访', due: '想再去的岛',
    test: '试航', exam: '地图尽头', wrong: '迷航', lost_list: '迷航记录', accuracy: '航准度',
    checkin: '升帆', streak: '航行天数', freeze: '停泊日', vocab: '航海日志', daily: '今日航程',
    curve: '航标亮度', progress: '星图', example: '船员的话', hint: '小铃提示', settings: '船舱', plain_mode: '纯文本航图',
    archive: '航海日志', collected: '登陆',
  },
  plainFrame: ['{name}翻开航海日志，上一任船员写着：', '漂流瓶里的纸条上写着：', '{name}指着灯塔上的刻字：'],
}

const store: ThemePack = {
  id: 'store',
  name: '心动便利店',
  tagline: '每个进门的客人，都带着一个新词。',
  tags: ['甜', '日常', '喜剧', '养成'],
  covers: ['g_dating', 'g_sim', 'd_sweet', 'd_comedy', 'd_office', 'n_romance', 'n_campus'],
  premise: 'A cosy 24-hour convenience store on a quiet street corner. Regulars come and go, each bringing a small story. The narrator is the new night-shift clerk who slowly gets to know everyone.',
  tone: 'gentle, funny, warm, slice-of-life, each scene ends with a small hook about a customer',
  characters: [
    { id: 'mentor', name: '店长', en: 'the Manager', role: '店长',
      correct: ['店长："嗯，可以。"', '店长头也不抬地竖了个大拇指。'],
      hint: ['店长："看看那位客人前后说了什么。"', '店长："这个词上周有人问过。"'],
      wrong: ['店长："上错菜了。没事，记本子上。"'],
      greet: ['凌晨一点，门铃响了。', '店长把今天的排班表贴在了柜台上。'],
      bye: ['店长："打烊。剩下的明天再说。"', '店长："回去路上小心。"'] },
    { id: 'rival', name: '隔壁咖啡店的林', en: 'Lin', role: '竞争对手',
      correct: ['林："哦？还行嘛。"'],
      hint: ['林："提示一次——别选最显眼那个。"'],
      wrong: ['林："这位客人，下次来我店里吧。"'],
      greet: ['林端着咖啡倚在门口。'], bye: ['林回去开店了。'] },
    { id: 'ally', name: '阿糖', en: 'Tang', role: '同事',
      correct: ['阿糖："对对对！"', '阿糖偷偷给了你一颗糖。'],
      hint: ['阿糖小声：我猜是"那个意思"……', '阿糖：店长刚才不是说了嘛。'],
      wrong: ['阿糖："没事，我第一天也这样。"'],
      greet: ['阿糖在货架后面探出头。'], bye: ['阿糖："明天见！记得吃早饭。"'] },
  ],
  chapters: ['夜班第一天', '常客们', '雨天的来电', '周末大促', '林的挑战', '停电之夜', '开分店'],
  palette: { bg: '#1c1418', bg2: '#2a1d24', fg: '#fff5f7', accent: '#ff9ec4', accent2: '#ffd98a', muted: '#a58a95' },
  motif: 'warm',
  terms: {
    ...BASE_TERMS,
    nav_home: '今日', nav_contacts: '会员卡', nav_settings: '店务',
    start: '开店', new_word: '新客人', unknown: '第一次来', known: '常客', review: '回头客上门', due: '老客来电',
    test: '高峰时段', exam: '开分店', wrong: '上错菜', lost_list: '差评记录本', accuracy: '好评率',
    checkin: '开门', streak: '连开天数', freeze: '歇业一天', vocab: '会员数', daily: '今日营业目标',
    curve: '熟客热度', progress: '街区扩张', example: '客人说的话', hint: '店长眼神', settings: '店务', plain_mode: '后厨模式',
    archive: '留言本', collected: '办卡',
  },
  plainFrame: ['{name}指了指留言本上的一句话：', '有位客人在便签上写下：', '{name}念出收音机里的一句话：'],
}

export const THEMES: Record<string, ThemePack> = { cyber, xian, star, store }
export const THEME_LIST = [cyber, xian, star, store]

export const INTEREST_GROUPS = {
  game: { label: '打游戏', items: [
    ['g_openworld', '开放世界冒险'], ['g_shooter', '竞技射击'], ['g_party', '派对休闲'], ['g_dating', '恋爱养成'],
    ['g_sim', '策略经营'], ['g_card', '卡牌抽卡'], ['g_horror', '恐怖解谜'], ['g_anime', '二次元动作'],
  ] },
  drama: { label: '追剧 / 短剧', items: [
    ['d_costume', '古装权谋'], ['d_sweet', '现代甜宠'], ['d_crime', '悬疑刑侦'], ['d_travel', '穿越重生'],
    ['d_comedy', '喜剧日常'], ['d_spy', '民国谍战'], ['d_office', '职场爽剧'], ['d_fantasy', '欧美奇幻'], ['d_scifi', '科幻'],
  ] },
  novel: { label: '看小说', items: [
    ['n_xuanhuan', '玄幻修仙'], ['n_urban', '都市异能'], ['n_rebirth', '穿书重生'], ['n_infinite', '无限流'],
    ['n_campus', '校园青春'], ['n_mystery', '悬疑推理'], ['n_history', '历史架空'], ['n_romance', '女频言情'],
  ] },
} as const

export const TONES: { id: Tone; label: string; en: string }[] = [
  { id: 'burn', label: '燃', en: 'intense and inspiring' },
  { id: 'sweet', label: '甜', en: 'sweet and heart-warming' },
  { id: 'cool', label: '爽', en: 'satisfying and punchy' },
  { id: 'suspense', label: '悬', en: 'suspenseful and mysterious' },
  { id: 'funny', label: '搞笑', en: 'funny and light' },
]

/** 根据兴趣选择映射主题；命中最多者胜，平局按顺序 */
export function pickTheme(interests: string[]): ThemePack {
  let best = THEME_LIST[0]
  let bestScore = -1
  for (const t of THEME_LIST) {
    const s = interests.filter(i => (t.covers as readonly string[]).includes(i)).length
    if (s > bestScore) { best = t; bestScore = s }
  }
  return best
}

export function pick<T>(arr: T[], seed?: number): T {
  const i = seed == null ? Math.floor(Math.random() * arr.length) : Math.abs(seed) % arr.length
  return arr[i]
}
