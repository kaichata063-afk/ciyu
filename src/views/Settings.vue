<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings, DEFAULT_MODELS, DEFAULT_BASE_URLS, type Provider } from '../stores/settings'
import { THEME_LIST, TONES } from '../themes'
import { ping } from '../llm'
import { exportArchive, importArchive, wipeAll } from '../db'

const S = useSettings()
const router = useRouter()
const providers: { id: Provider; label: string; help: string }[] = [
  { id: 'deepseek', label: 'DeepSeek', help: 'platform.deepseek.com 创建密钥；OpenAI 兼容接口，价格最低。' },
  { id: 'anthropic', label: 'Claude', help: 'console.anthropic.com 创建密钥；支持浏览器直连。' },
  { id: 'openai', label: 'GPT', help: 'platform.openai.com 创建密钥。' },
]
const p = computed(() => S.s.provider)
const key = computed({ get: () => S.s.apiKeys[p.value] || '', set: v => { S.s.apiKeys = { ...S.s.apiKeys, [p.value]: v.trim() } } })
const model = computed({ get: () => S.s.models[p.value] || '', set: v => { S.s.models = { ...S.s.models, [p.value]: v.trim() } } })
const baseUrl = computed({ get: () => S.s.baseUrls[p.value] || '', set: v => { S.s.baseUrls = { ...S.s.baseUrls, [p.value]: v.trim() } } })
const testing = ref(false)
const testMsg = ref('')
const showKey = ref(false)

async function test() {
  testing.value = true; testMsg.value = ''
  try {
    const ok = await ping({ provider: p.value, apiKey: key.value, model: model.value || undefined, baseUrl: baseUrl.value || undefined })
    testMsg.value = ok ? '✓ 连接成功' : '连接成功但回复异常，请检查模型名'
  } catch (e: any) {
    const m = String(e?.message || e)
    testMsg.value = /Failed to fetch|NetworkError|CORS/i.test(m)
      ? '× 浏览器直连被拒绝（CORS）。可改用支持直连的中转地址，或参考仓库 worker/ 目录自建一个中转。'
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
      <h3>AI 剧情（可选）</h3>
      <p class="muted small">不填也能用：内置片段与真题原句免费可用。填入你自己的密钥后，剧情会按你的世界与口味即时生成。密钥只保存在这台设备的浏览器里，不会上传到任何服务器。</p>
      <div class="chips">
        <button v-for="pr in providers" :key="pr.id" class="chip" :class="{ on: S.s.provider === pr.id }" @click="S.s.provider = pr.id">{{ pr.label }}<span v-if="S.s.apiKeys[pr.id]" style="margin-left:6px">●</span></button>
      </div>
      <p class="muted small">{{ providers.find(x => x.id === p)?.help }}</p>
      <div class="field">
        <label>API 密钥</label>
        <div class="row">
          <input :type="showKey ? 'text' : 'password'" v-model="key" placeholder="sk-…" style="flex:1" autocomplete="off" />
          <button class="btn ghost sm" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        </div>
      </div>
      <div class="field"><label>模型（留空用默认：{{ DEFAULT_MODELS[p] }}）</label><input v-model="model" :placeholder="DEFAULT_MODELS[p]" /></div>
      <div class="field"><label>接口地址（留空用官方：{{ DEFAULT_BASE_URLS[p] }}；可填中转地址）</label><input v-model="baseUrl" :placeholder="DEFAULT_BASE_URLS[p]" /></div>
      <label class="row between"><span>允许用我的密钥即时生成剧情</span><input type="checkbox" class="toggle" v-model="S.s.allowGenerate" /></label>
      <div class="row">
        <button class="btn sm" :disabled="!key || testing" @click="test">{{ testing ? '测试中…' : '测试连接' }}</button>
        <span class="small" :class="{ muted: !testMsg }">{{ testMsg }}</span>
      </div>
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
