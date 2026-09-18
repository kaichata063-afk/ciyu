import { LLMError } from './index'

export interface ImageConfig {
  apiKey: string
  baseUrl?: string   // OpenAI 兼容：默认 https://api.openai.com
  model?: string     // 默认 gpt-image-1；也可填 dall-e-3 或第三方兼容模型名
}

/** 调用 OpenAI 兼容的 /v1/images/generations，返回 data URL（base64）或远程 URL */
export async function generateImage(cfg: ImageConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const base = (cfg.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const model = cfg.model || 'gpt-image-1'
  const body: any = { model, prompt, n: 1, size: '1024x1024' }
  if (/dall-e/i.test(model)) body.response_format = 'b64_json'
  else body.quality = 'low'
  const r = await fetch(`${base}/v1/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok) throw new LLMError((await r.text()).slice(0, 300), r.status)
  const j = await r.json()
  const d = j.data?.[0]
  if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`
  if (d?.url) return d.url
  throw new LLMError('no image in response')
}
