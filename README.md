# 词屿 · 试用版 v0.2

一部由你"收服"的四级高频词推进剧情的互动小说。按你的兴趣定制世界，老朋友按记忆规律回访，全程不出现一个学习术语；免费、无需登录，手机 / 平板 / 电脑浏览器打开链接即用。

## 特点

- **先选世界再见单词**：首次进入用 4 屏（≤60 秒）收集兴趣 → 自动匹配 4 个原创世界之一（霓虹裂隙 / 云海问道 / 星野旅团 / 心动便利店）。
- **真题高频词 Top-1250**：基于 2021–2025 四级真题词频（词形还原版），7 章按收服数解锁；每个词附真题原句。
- **FSRS 间隔重复**（`ts-fsrs`，期望保留率 0.85）：老朋友到期回访；同一词在 3 个不同场景答对才算"收服"。
- **三种题型按记忆状态切换**：选义 → 拼写补全 → 台词填词。
- **全套术语替代**：复习 = 老友回访 / 错词本 = 走散名册 / 连胜 = 同行天数……每个世界还有自己的变体；提供"素颜模式"一键还原标准术语。
- **AI 剧情可选（BYOK）**：填入你自己的 DeepSeek / Claude / GPT 密钥，剧情按你的世界与口味即时生成；不填也能用（真题原句 + 角色引导）。密钥只存在本机浏览器。
- **无后端**：所有数据在本机 IndexedDB；导出 / 导入存档实现跨设备。

## 本地运行

```bash
npm install
npm run fetch:data     # 下载上游开源词频与词典数据到 data-src/
npm run build:words    # 生成 public/data/words.json（1250 词）
npm run dev            # http://localhost:5173
```

## 剧情包（已生成，随仓库提供）

`public/data/snippets/{theme}/ch{N}.json`：4 个世界 × 1250 词 × 3 场景 = 14,999 段，由 `claude-sonnet-4-6` 在构建期生成并经规则校验，按章拆分、运行时按需加载（第 1 章约 50 KB）。整包备份在 `data-src/snippets-full/`（已 gitignore）。

重新生成或补缺：

```bash
# .env.local 里放 ANTHROPIC_API_KEY（可选 ANTHROPIC_BASE_URL / ANTHROPIC_MODEL）
npm run gen:snippets            # 生成（幂等，可中断续跑）→ 修正中文提示里的角色名 → 按章拆分
node scripts/audit-snippets.mjs # 覆盖率与抽样审计
```

## 构建与部署

```bash
npm run build          # 产物在 dist/，纯静态
```

任意静态托管即可：Cloudflare Pages / Vercel / Netlify / GitHub Pages / 自己的 Nginx。部署到子路径时设置 `BASE_PATH=/子路径/ npm run build`。

## 端到端冒烟测试

```bash
npx playwright install chromium
npm run preview &      # 默认 4173 端口
npm run test:e2e       # 走完 onboarding → 会话 → 结算 → 词库 → 设置 → 导出，截图到 /tmp/ciyu-shots
```

## 可选：API 中转

OpenAI 与 Anthropic 官方接口支持浏览器直连。若某家接口在你的网络下拒绝跨域，可把 `worker/relay.js` 部署为 Cloudflare Worker，然后在「设置 → 接口地址」填入 `https://<你的>.workers.dev/deepseek`（或 `/openai`、`/anthropic`）。Worker 不保存任何数据。

## 目录

```
scripts/build-words.mjs   词库构建（真题词频 × 词典释义 → words.json）
scripts/e2e-smoke.mjs     Playwright 冒烟
src/engine/fsrs.ts        FSRS 封装（评分映射、可提取性）
src/engine/session.ts     选词、组题、作答记录
src/engine/content.ts     片段获取：本机缓存 → 静态包 → 按需生成 → 真题兜底；规则校验
src/llm/                  三家供应商适配 + Prompt
src/themes/index.ts       4 个世界：设定、角色台词池、术语映射、配色
src/views/                Onboarding / Home / Session / Contacts / Settings
public/data/words.json    词库
public/data/snippets/     （可选）构建期预生成的静态剧情包 {theme}.json
worker/relay.js           可选中转
```

## 数据来源与许可

- 真题词频、真题例句：[yiyisheh/CET4-vocabulary](https://github.com/yiyisheh/CET4-vocabulary)（MIT；真题源数据版权归命题方，仅供学习研究）。
- 释义、词性、例句：[llllli-eng/CETWords](https://github.com/llllli-eng/CETWords) ← [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)（上游无正式许可证，仅限非商业学习用途；如需商业使用需向上游作者确认）。
- 记忆算法：[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（MIT）。
- 剧情文本由 AI 生成，界面带"AI 生成"标识；所有世界观、角色、命名均为原创，不代表任何现实作品。
