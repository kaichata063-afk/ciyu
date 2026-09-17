// 轻量音效：WebAudio 合成，无需资源文件
let ctx: AudioContext | null = null
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
export function playSfx(kind: 'correct' | 'wrong' | 'hint' | 'collect', enabled: boolean) {
  if (!enabled) return
  try {
    if (kind === 'correct') { tone(660, 0.12); tone(880, 0.16, 'sine', 0.08, 0.09) }
    else if (kind === 'collect') { tone(523, 0.12); tone(659, 0.12, 'sine', 0.08, 0.1); tone(784, 0.12, 'sine', 0.08, 0.2); tone(1046, 0.25, 'sine', 0.09, 0.3) }
    else if (kind === 'hint') { tone(440, 0.1, 'triangle', 0.05) }
    else { tone(220, 0.18, 'triangle', 0.06) }
  } catch { /* ignore */ }
}
