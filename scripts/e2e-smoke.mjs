// 端到端冒烟：走完 onboarding → 一次完整会话 → 结算 → 通讯录 → 设置；截图到 /tmp/ciyu-shots
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:4173/'
const OUT = '/tmp/ciyu-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'zh-CN' })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`) })
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: true })

  await page.goto(BASE)
  await page.waitForSelector('text=先别管英语')
  await shot('01-onboard')
  await page.click('text=打游戏')
  await page.click('text=下一步')
  await page.click('text=竞技射击')
  await page.click('text=下一步')
  await page.click('text=跳过')
  await page.click('text=燃')
  await page.click('text=揭晓我的世界')
  await page.waitForSelector('text=霓虹裂隙')
  await shot('02-reveal')
  await page.click('button:has-text("接单")')
  await page.waitForSelector('text=这一段：')
  await shot('03-hook')
  await page.click('button:has-text("继续")')

  // 答题：读 mark 里的目标词，从 options 中找匹配正确项（用 DOM 暴露的数据不便，这里用策略：先点第一个，错了再点第二个…）
  let steps = 0
  while (steps < 30) {
    steps++
    const done = await page.$('text=看看这一段的结局')
    const cont = await page.$('button:has-text("继续 ▸")')
    if (done) { await shot(`04-q${steps}-feedback`); await done.click(); break }
    if (cont) { await cont.click(); continue }
    const opts = await page.$$('.opt:not([disabled])')
    const spell = await page.$('input.spell')
    if (opts.length) {
      if (steps === 1) await shot('04-q1-ask')
      await opts[0].click()
      await page.waitForTimeout(150)
    } else if (spell) {
      // 拼写题：从 placeholder 首字母无法得知全词，故先答错一次拿提示，再用"早就认识"不可用（复习词）→ 直接再错一次
      if (steps < 5) await shot(`04-q${steps}-spell`)
      await spell.fill('zzz')
      await page.click('button:has-text("确定")')
      await page.waitForTimeout(150)
    } else {
      await page.waitForTimeout(200)
    }
  }
  await page.waitForSelector('text=这一段，你靠', { timeout: 15000 })
  await shot('05-scene')
  await page.click('button:has-text("今天够了")')
  await page.waitForSelector('text=同行')
  await shot('06-home')
  await page.click('.nav-item >> nth=1')
  await page.waitForSelector('text=全部')
  await page.click('text=全部')
  await page.waitForTimeout(300)
  await shot('07-contacts')
  await page.click('.list-item')
  await page.waitForTimeout(300)
  await shot('08-wordcard')
  await page.click('button:has-text("✕")')
  await page.click('.nav-item >> nth=2')
  await page.waitForSelector('text=AI 剧情')
  await shot('09-settings')
  // 切换主题 + 素颜模式
  await page.click('text=云海问道')
  await page.waitForTimeout(300)
  await shot('10-theme-xian')
  await page.click('input.toggle >> nth=0')
  await page.waitForTimeout(300)
  await page.click('.nav-item >> nth=0')
  await page.waitForTimeout(300)
  await shot('11-plain-home')
  // 存档导出存在
  await page.goto(BASE + '#/settings')
  await page.waitForSelector('button:has-text("导出存档")')
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("导出存档")')])
  console.log(`[${name}] archive:`, await d.suggestedFilename())
  await ctx.close()
}

await run('mobile', { width: 390, height: 844 })
await run('desktop', { width: 1280, height: 860 })
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('SMOKE OK, screenshots in', OUT)
