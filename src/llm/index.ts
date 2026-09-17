import { DEFAULT_BASE_URLS, DEFAULT_MODELS, type Provider } from '../stores/settings'

export interface LLMConfig {
  provider: Provider
  apiKey: string
  model?: string
  baseUrl?: string
}

export interface GenOpts {
  system?: string
  temperature?: number
  maxTokens?: number
  json?: boolean
  signal?: AbortSignal
}

export class LLMError extends Error {
  status?: number
  constructor(msg: string, status?: number) { super(msg); this.status = status }
}

/** 统一入口：三家供应商，浏览器直连（BYOK） */
export async function generate(cfg: LLMConfig, prompt: string, opts: GenOpts = {}): Promise<string> {
  const model = cfg.model || DEFAULT_MODELS[cfg.provider]
  const base = (cfg.baseUrl || DEFAULT_BASE_URLS[cfg.provider]).replace(/\/+$/, '')
  if (cfg.provider === 'anthropic') return anthropic(base, cfg.apiKey, model, prompt, opts)
  return openaiCompatible(base, cfg.apiKey, model, prompt, opts)
}

async function openaiCompatible(base: string, key: string, model: string, prompt: string, o: GenOpts) {
  const body: any = {
    model,
    messages: [
      ...(o.system ? [{ role: 'system', content: o.system }] : []),
      { role: 'user', content: prompt },
    ],
    temperature: o.temperature ?? 0.8,
    max_tokens: o.maxTokens ?? 1200,
  }
  if (o.json) body.response_format = { type: 'json_object' }
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: o.signal,
  })
  if (!r.ok) throw new LLMError(await safeText(r), r.status)
  const j = await r.json()
  return j.choices?.[0]?.message?.content ?? ''
}

async function anthropic(base: string, key: string, model: string, prompt: string, o: GenOpts) {
  const r = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: o.maxTokens ?? 1200,
      temperature: o.temperature ?? 0.8,
      ...(o.system ? { system: o.system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: o.signal,
  })
  if (!r.ok) throw new LLMError(await safeText(r), r.status)
  const j = await r.json()
  return (j.content || []).map((c: any) => c.text || '').join('')
}

async function safeText(r: Response) {
  try { const t = await r.text(); return t.slice(0, 400) } catch { return `HTTP ${r.status}` }
}

/** 从模型输出中提取 JSON（容忍 ```json 包裹与前后杂讯） */
export function extractJSON<T = any>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : text
  const start = body.search(/[\[{]/)
  if (start < 0) throw new Error('no json')
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'))
  return JSON.parse(body.slice(start, end + 1))
}

/** 连通性测试 */
export async function ping(cfg: LLMConfig) {
  const t = await generate(cfg, 'Reply with the single word: pong', { maxTokens: 5, temperature: 0 })
  return /pong/i.test(t)
}
