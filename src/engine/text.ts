/** 把英文段落切成句子（在 . ! ? … 后接引号/括号与空格、且下一句以大写/引号/星号/数字开头处切分） */
export function splitSentences(text: string): string[] {
  const re = /([.!?…]+["'”’)]*)\s+(?=["'“‘(*]?[A-Z0-9])/g
  const out: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    out.push(text.slice(last, m.index + m[1].length).trim())
    last = m.index + m[1].length
  }
  const tail = text.slice(last).trim()
  if (tail) out.push(tail)
  return out.filter(Boolean)
}

export function isTargetSentence(s: string) {
  return /\*[^*]+\*/.test(s)
}
