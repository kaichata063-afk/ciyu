// 轻量音效：WebAudio 合成，无需资源文件
let ctx: AudioContext | null = null
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, when = 0) {
  const a = ac()
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0, a.currentTime + when)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02)
}
// 钻石音：清脆的三角波叮 + 高次谐波闪光
function gem(base: number, when = 0, gain = 0.07) {
  tone(base, 0.18, 'triangle', gain, when)
  tone(base * 2, 0.12, 'sine', gain * 0.5, when + 0.02)
  tone(base * 3, 0.08, 'sine', gain * 0.25, when + 0.04)
}
// 大调音阶（C5 起），连击越高音越高
const SCALE = [523, 587, 659, 784, 880, 1046, 1174, 1318, 1568, 1760]

export type Sfx = 'gem' | 'combo5' | 'collect' | 'hint' | 'pat'

/** combo：当前连击数，决定钻石音高与叠加层数 */
export function playSfx(kind: Sfx, enabled: boolean, combo = 1) {
  if (!enabled) return
  try {
    if (kind === 'gem') {
      const idx = Math.min(combo - 1, SCALE.length - 1)
      gem(SCALE[idx])
      // 连击 ≥2 叠加前一个音，≥4 再叠一个，形成琶音上行
      if (combo >= 2) gem(SCALE[Math.max(0, idx - 1)], 0.07, 0.05)
      if (combo >= 4) gem(SCALE[Math.max(0, idx - 2)], 0.14, 0.04)
    } else if (kind === 'combo5') {
      // 每 5 连击：快速上行琶音 + 长尾
      [0, 2, 4, 6, 8].forEach((i, k) => gem(SCALE[Math.min(i, SCALE.length - 1)], k * 0.06, 0.06))
      tone(SCALE[9], 0.5, 'sine', 0.05, 0.32)
    } else if (kind === 'collect') {
      [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.14, 'sine', 0.08, k * 0.09))
      tone(1568, 0.35, 'triangle', 0.06, 0.36)
    } else if (kind === 'hint') {
      tone(440, 0.1, 'triangle', 0.05)
    } else if (kind === 'pat') {
      // 摸摸头：两下柔软的低音"啵、啵"，正弦波，音量低
      tone(196, 0.16, 'sine', 0.05)
      tone(220, 0.2, 'sine', 0.045, 0.18)
    }
  } catch { /* ignore */ }
}
