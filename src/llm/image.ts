import { LLMError } from './index'

export interface ImageConfig {
  apiKey: string
  baseUrl?: string   // OpenAI 兼容：默认 https://api.openai.com
  model?: string     // 任意 OpenAI 兼容图像模型名：gpt-image-1 / gpt-image-1-mini / dall-e-3 / 第三方兼容模型等
  quality?: string   // 可选，仅 gpt-image 系列生效（low/medium/high/auto）；留空则用 low
  size?: string      // 可选，默认 1024x1024
}

/** 调用 OpenAI 兼容的 /v1/images/generations，返回 data URL（base64）或远程 URL。
 * 不绑定具体模型版本：按模型族选参数，未知模型只发最小通用字段以求最大兼容。 */
export async function generateImage(cfg: ImageConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const base = (cfg.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const model = cfg.model || 'gpt-image-1'
  const body: any = { model, prompt, n: 1, size: cfg.size || '1024x1024' }
  if (/dall-e/i.test(model)) {
    // DALL·E 系列：默认返回远程 URL，显式要 base64
    body.response_format = 'b64_json'
  } else if (/gpt-image/i.test(model)) {
    // gpt-image 全系列（gpt-image-1 / gpt-image-1-mini / gpt-image-2 及后续版本）：
    // 始终返回 base64、不接受 response_format，可传 quality
    body.quality = cfg.quality || 'low'
  }
  // 其它未知/第三方兼容模型：只发 model+prompt+n+size，不塞可能不被支持的参数
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
