// 可选：Cloudflare Worker 极简中转（仅当某家 API 拒绝浏览器直连 / CORS 时才需要）
// 部署：在 Cloudflare Dashboard → Workers → 新建 → 粘贴本文件 → 部署，得到 https://xxx.workers.dev
// 然后在词屿「设置 → 接口地址」填 https://xxx.workers.dev/deepseek（或 /openai、/anthropic）
// 密钥仍由浏览器在请求头里携带，Worker 不保存任何东西。
const UPSTREAM = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Max-Age': '86400',
}
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(req.url)
    const [, name, ...rest] = url.pathname.split('/')
    const base = UPSTREAM[name]
    if (!base) return new Response('unknown upstream', { status: 404, headers: CORS })
    const target = base + '/' + rest.join('/') + url.search
    const headers = new Headers(req.headers)
    headers.delete('host'); headers.delete('origin'); headers.delete('referer')
    const r = await fetch(target, { method: req.method, headers, body: req.body })
    const out = new Headers(r.headers)
    for (const [k, v] of Object.entries(CORS)) out.set(k, v)
    return new Response(r.body, { status: r.status, headers: out })
  },
}
