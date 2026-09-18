<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettings, DEFAULT_MODELS, DEFAULT_BASE_URLS, type Provider } from '../stores/settings'
import { THEME_LIST, TONES } from '../themes'
import { ping } from '../llm'
import { exportArchive, importArchive, wipeAll } from '../db'

const S = useSettings()
const router = useRouter()
const route = useRoute()
const providers: { id: Provider; label: string; site: string; steps: string[]; note: string }[] = [
  { id: 'deepseek', label: 'DeepSeek', site: 'https://platform.deepseek.com/api_keys',
    steps: ['注册并充值（10 元起，够用几个月）', '左侧「API keys」→ 创建 → 复制以 sk- 开头的密钥', '粘贴到下方，点「测试连接」'],
    note: '国内直连、最便宜。官方接口对浏览器直连可能受限，若测试报 CORS，把「接口地址」换成支持跨域的中转地址。' },
  { id: 'anthropic', label: 'Claude', site: 'https://console.anthropic.com/settings/keys',
    steps: ['登录控制台并绑定付款方式', '「API Keys」→ Create Key → 复制以 sk-ant- 开头的密钥', '粘贴到下方，点「测试连接」'],
    note: '官方接口支持浏览器直连。若你用的是第三方中转（如 new-api 站点），把站点地址填到「接口地址」，模型名按站点提供的填。' },
  { id: 'openai', label: 'GPT', site: 'https://platform.openai.com/api-keys',
    steps: ['登录并充值', '「API keys」→ Create new secret key → 复制以 sk- 开头的密钥', '粘贴到下方，点「测试连接」'],
    note: '官方接口支持浏览器直连；国内网络可能需要中转地址。' },
]
const cur = computed(() => providers.find(x => x.id === S.s.provider)!)
const p = computed(() => S.s.provider)
const key = computed({ get: () => S.s.apiKeys[p.value] || '', set: v => { S.s.apiKeys = { ...S.s.apiKeys, [p.value]: v.trim() } } })
const model = computed({ get: () => S.s.models[p.value] || '', set: v => { S.s.models = { ...S.s.models, [p.value]: v.trim() } } })
const baseUrl = computed({ get: () => S.s.baseUrls[p.value] || '', set: v => { S.s.baseUrls = { ...S.s.baseUrls, [p.value]: v.trim() } } })
const testing = ref(false)
const testMsg = ref('')
const showKey = ref(false)
const showAdvanced = ref(!!(S.s.models[S.s.provider] || S.s.baseUrls[S.s.provider]))
const keyEl = ref<HTMLInputElement | null>(null)
onMounted(() => { if (route.query.focus === 'ai') nextTick(() => { keyEl.value?.scrollIntoView({ block: 'center' }); keyEl.value?.focus() }) })

async function test() {
  testing.value = true; testMsg.value = ''
  try {
    const ok = await ping({ provider: p.value, apiKey: key.value, model: model.value || undefined, baseUrl: baseUrl.value || undefined })
    testMsg.value = ok ? '✓ 连接成功' : '连接成功但回复异常，请检查模型名'
  } catch (e: any) {
    const m = String(e?.message || e)
    testMsg.value = /Failed to fetch|NetworkError|CORS/i.test(m)
      ? '× 浏览器无法直连这个接口（跨域被拒或网络不通）。请在「接口地址」填一个支持浏览器访问的中转地址；也可以按仓库 worker/relay.js 自己免费部署一个。'
      : /401|invalid.*key|authentication/i.test(m) ? '× 密钥无效或已过期，请重新复制。'
      : /402|insufficient|balance|quota|余额/i.test(m) ? '× 账户余额不足，请先充值。'
      : /404|model/i.test(m) ? `× 模型名不对或该接口不提供此模型。当前：${model.value || DEFAULT_MODELS[p.value]}`
      : `× ${m.slice(0, 160)}`
  } finally { testing.value = false }
}

async function doExport() {
  const data = await exportArchive()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ciyu-archive-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    await importArchive(JSON.parse(await f.text()))
    alert('导入完成')
    location.reload()
  } catch (err: any) { alert('导入失败：' + err.message) }
}
function switchTheme(id: string) {
  if (S.s.themeId === id) return
  S.s.themeId = id
  localStorage.removeItem('ciyu:lastHook')
}
function redo() { router.push({ path: '/start', query: { redo: '1' } }) }
async function wipe() {
  if (confirm('确定删除本机全部数据（进度、存档、密钥）？此操作不可恢复。建议先导出存档。')) await wipeAll()
}
</script>

<template>
  <div class="stack">
    <h1>{{ S.t('nav_settings') }}</h1>

    <div class="card stack" id="ai" :style="S.hasKey ? '' : 'border-color: var(--accent)'">
      <div class="row between">
        <h3 style="margin:0">{{ S.hasKey ? '● AI 剧情已接入' : '⚡ 填入 API 密钥' }} <span class="muted small" v-if="!S.hasKey">（可选）</span></h3>
        <span v-if="S.hasKey" class="small" style="color: var(--accent)">{{ cur.label }}</span>
      </div>
      <div class="chips">
        <button v-for="pr in providers" :key="pr.id" class="chip" :class="{ on: S.s.provider === pr.id }" @click="S.s.provider = pr.id">{{ pr.label }}<span v-if="S.s.apiKeys[pr.id]" style="margin-left:6px; color: var(--accent)">●</span></button>
      </div>
      <div class="field">
        <label>{{ cur.label }} API 密钥</label>
        <div class="row">
          <input ref="keyEl" :type="showKey ? 'text' : 'password'" v-model="key" :placeholder="cur.id === 'anthropic' ? 'sk-ant-…' : 'sk-…'" style="flex:1; font-size: 16px" autocomplete="off" spellcheck="false" />
          <button class="btn ghost sm" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        </div>
      </div>
      <div class="row wrap">
        <button class="btn sm" :disabled="!key || testing" @click="test">{{ testing ? '测试中…' : '测试连接' }}</button>
        <button class="btn ghost sm" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '收起' : '模型 / 接口地址' }}</button>
        <button v-if="key" class="btn ghost sm" style="color: var(--accent2)" @click="key = ''">清除密钥</button>
      </div>
      <p v-if="testMsg" class="small" :style="{ color: testMsg.startsWith('✓') ? 'var(--accent)' : 'var(--accent2)' }">{{ testMsg }}</p>
      <template v-if="showAdvanced">
        <div class="field"><label>模型（留空用默认：{{ DEFAULT_MODELS[p] }}）</label><input v-model="model" :placeholder="DEFAULT_MODELS[p]" /></div>
        <div class="field"><label>接口地址（留空用官方：{{ DEFAULT_BASE_URLS[p] }}；用第三方中转就填中转地址）</label><input v-model="baseUrl" :placeholder="DEFAULT_BASE_URLS[p]" /></div>
      </template>
      <details class="small">
        <summary style="cursor:pointer; color: var(--accent)">怎么拿到 {{ cur.label }} 的密钥？填与不填有什么区别？</summary>
        <div class="card" style="background: var(--bg); margin-top: 10px">
          <div class="row between"><b>获取 {{ cur.label }} 密钥</b><a :href="cur.site" target="_blank" rel="noopener" style="color: var(--accent)">打开官网 ↗</a></div>
          <ol style="margin: 8px 0 0; padding-left: 20px"><li v-for="st in cur.steps" :key="st">{{ st }}</li></ol>
          <p class="muted" style="margin: 8px 0 0">{{ cur.note }}</p>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px">
          <div class="card" style="background: var(--bg); padding: 12px"><div class="muted">不填</div><div style="margin-top:4px">用内置剧情包：15,000 段预先写好的片段，免费、不联网调用。</div></div>
          <div class="card" style="background: var(--bg); padding: 12px; border-color: var(--accent)"><div style="color: var(--accent)">填了</div><div style="margin-top:4px">每段过场、口味点缀、缺失片段都由 AI 按你的世界即时写。按你自己的账户计费，每次约几分钱。</div></div>
        </div>
        <p class="muted" style="margin: 10px 0 0">密钥只保存在这台设备的浏览器里，不会经过词屿的任何服务器（词屿没有服务器）。</p>
      </details>
      <template v-if="S.hasKey">
        <label class="row between"><span>允许用我的密钥即时生成剧情</span><input type="checkbox" class="toggle" v-model="S.s.allowGenerate" /></label>
        <label class="row between" :style="{ opacity: S.s.allowGenerate ? 1 : .4 }"><span>词片段也全部即时生成 <span class="muted small">— 更个性化，但每段多花几分钱、多等几秒</span></span><input type="checkbox" class="toggle" v-model="S.s.preferFresh" :disabled="!S.s.allowGenerate" /></label>
      </template>
    </div>

    <div class="card stack">
      <h3>更换世界</h3>
      <div class="chips">
        <button v-for="t in THEME_LIST" :key="t.id" class="chip" :class="{ on: S.s.themeId === t.id }" @click="switchTheme(t.id)">{{ t.name }}</button>
      </div>
      <p class="muted small">切换后剧情从新世界第一章开始，词汇进度、{{ S.t('streak') }}全部保留。</p>
      <div class="row between">
        <span>口味</span>
        <div class="chips"><button v-for="t in TONES" :key="t.id" class="chip sm" :class="{ on: S.s.tone === t.id }" @click="S.s.tone = t.id">{{ t.label }}</button></div>
      </div>
      <button class="btn ghost sm" @click="redo">重新选择兴趣</button>
    </div>

    <div class="card stack">
      <div class="row between"><span>{{ S.t('daily') }}</span>
        <div class="chips"><button v-for="n in [4, 6, 8]" :key="n" class="chip sm" :class="{ on: S.s.pace === n }" @click="S.s.pace = n as 4|6|8">{{ n === 4 ? '轻' : n === 6 ? '标准' : '冲刺' }}({{ n }})</button></div>
      </div>
      <label class="row between"><span>{{ S.t('plain_mode') }} <span class="muted small">— 关闭剧情与全部趣味包装</span></span><input type="checkbox" class="toggle" v-model="S.s.plainMode" /></label>
      <label class="row between"><span>音效</span><input type="checkbox" class="toggle" v-model="S.s.sound" /></label>
    </div>

    <div class="card stack">
      <h3>数据</h3>
      <p class="muted small">所有数据都在本机浏览器。换设备时：这里导出存档，在新设备上导入即可继续。</p>
      <div class="row wrap">
        <button class="btn ghost sm" @click="doExport">导出存档</button>
        <label class="btn ghost sm">导入存档<input type="file" accept="application/json" style="display:none" @change="doImport" /></label>
        <button class="btn ghost sm" style="color: var(--accent2)" @click="wipe">删除全部数据</button>
      </div>
    </div>

    <div class="card stack small muted">
      <h3 style="color: var(--fg)">关于</h3>
      <p>词屿 · 试用版 v0.2。一部由你收服的四级高频词推进剧情的互动小说。</p>
      <p>剧情文本由 AI 生成（内置片段在构建时生成；即时片段由你的密钥生成），均带"AI 生成"标识。真题例句与词频统计来自开源项目 <a href="https://github.com/yiyisheh/CET4-vocabulary" target="_blank" style="text-decoration: underline">yiyisheh/CET4-vocabulary</a>（MIT）；释义与例句来自 <a href="https://github.com/llllli-eng/CETWords" target="_blank" style="text-decoration: underline">CETWords</a> / KyleBing/english-vocabulary，仅限非商业学习用途。记忆调度使用 <a href="https://github.com/open-spaced-repetition/ts-fsrs" target="_blank" style="text-decoration: underline">ts-fsrs</a>。</p>
      <p>所有世界观、角色与命名均为原创，不代表任何现实作品。</p>
    </div>
  </div>
</template>
