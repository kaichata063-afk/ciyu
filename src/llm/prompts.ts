import type { ThemePack, Tone } from '../themes'
import { TONES } from '../themes'
import type { Word } from '../types'

export function systemPrompt(theme: ThemePack, tone: Tone, styleTags: string[]) {
  const toneEn = TONES.find(t => t.id === tone)?.en || 'engaging'
  const chars = theme.characters.map(c => `${c.en} (${c.role})`).join(', ')
  return `You write short English interactive-fiction snippets for Chinese university students preparing for CET-4.
World: ${theme.premise}
Tone: ${theme.tone}; overall flavour: ${toneEn}${styleTags.length ? `; style hints: ${styleTags.join(', ')}` : ''}.
Characters (use ONLY these English names in the prose): ${chars}.
Hard rules:
- Use only common English (CET-4 top-3000 words) except the target words.
- Never mention any real-world work of fiction, brand, celebrity or real person.
- Keep every snippet self-contained; no violence beyond mild peril; no romance beyond light warmth.
- Output valid JSON only.`
}

/** 一次为多词生成片段（省 token）。每词：en(40–60 词，目标词用 *word* 标出恰好 1 次)、cn_hint、hook、line */
export function snippetsPrompt(words: Word[], slot: number, chapterTitle: string, theme?: ThemePack) {
  const list = words.map(w => `- "${w.word}" (${w.meanings[0]?.pos || ''} ${w.core})`).join('\n')
  const CN_NAMES = theme ? theme.characters.map(c => `${c.en}=${c.name}`).join(', ') : ''
  return `Chapter: ${chapterTitle}. Scene slot: ${slot} (use a different location/event from other slots).
For EACH target word below, write one snippet.

${list}

Requirements per snippet:
1. "en": 40–60 words of story in 3–5 sentences, containing the target word exactly once, wrapped in asterisks like *word* (inflected forms allowed: *words*, *worked*). The sentence with the target word must be essential to understanding the scene, and the context must make the meaning inferable.
2. "cn": array of Simplified Chinese translations, one per sentence of "en" in order — natural and vivid, using the characters' Chinese names (${CN_NAMES}). For the sentence containing the target word, output an empty string "" (it stays in English).
3. "cn_hint": one short Chinese sentence hinting at what happens, WITHOUT translating the target word (use ____ for it).
4. "hook": one suspenseful closing sentence in English, ≤ 12 words.
5. "line": one short spoken line (≤ 14 words) by a character that contains the target word exactly once, wrapped in asterisks.
Return JSON: {"items":[{"word":"...","en":"...","cn":["...",""...],"cn_hint":"...","hook":"...","line":"..."}]}`
}

/** 章节过场：把 6 个词串成 120–160 词 */
export function chapterScenePrompt(words: Word[], chapterTitle: string, previousHook?: string, theme?: ThemePack) {
  const list = words.map(w => `*${w.word}*`).join(', ')
  const names = theme ? theme.characters.map(c => `${c.en}=${c.name}`).join(', ') : ''
  return `Chapter: ${chapterTitle}.${previousHook ? ` Continue from: "${previousHook}"` : ''}
Write a 120–160 word English scene in 8–12 sentences that uses each of these words exactly once, in this order, each wrapped in asterisks: ${list}. Put at most ONE target word per sentence.
End with a one-sentence cliff-hanger.
Then give "cn": an array with one Simplified Chinese translation per sentence of "en", in order, vivid and natural, using Chinese character names (${names}); for any sentence containing a target word output "" instead.
Return JSON: {"en":"...","cn":["...","",...],"hook":"..."}`
}

/** 简笔漫画配图：给图像模型的英文提示词 */
export function illustrationPrompt(sceneEn: string, theme: ThemePack) {
  const chars = theme.characters.map(c => c.en).join(', ')
  return `Minimal black-and-white line-art comic panel, simple sketch style, thick clean outlines, no text, no letters, no captions. Scene: ${sceneEn.replace(/\*/g, '')} Characters that may appear: ${chars}. Mood: ${theme.tone}. Square composition, white background.`
}

/** 自定义作品名 → 风格标签（不保留作品名） */
export function styleTagsPrompt(input: string) {
  return `A student says they recently enjoyed: "${input}".
Do NOT repeat the title, characters or any proper noun. Output 3–5 short English style tags describing the vibe (e.g. "heist", "slow-burn romance", "found family", "cyberpunk", "court intrigue").
Return JSON: {"tags":["...","..."]}`
}
