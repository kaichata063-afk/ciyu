# 词库来源与转换记录

## 来源与授权边界

- 仓库：[KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)
- 分支：`master`
- 数据目录：`json_original/json-sentence`
- 本次转换日期：2026-08-12

正式词库仅在构建时读取源文件；网页运行时只读取本项目内的 `data/cet4.json` 与 `data/cet6.json`。本阶段没有引入外部词典、商业网页抓取或 AI 批量生成释义。

截至本次核对，仓库根目录没有明确的 `LICENSE` 文件，README 中的学习分享说明不能替代正式开源许可证。因此这里只记录来源，不声称获得商业再分发授权；如需公开或商业使用，应先向上游作者确认授权。

## 词汇归属

| 词库 | 主来源 | 主来源原始条目 | 核心词 | 补充来源 | 补充词 | 最终总数 |
|---|---|---:|---:|---|---:|---:|
| CET4 | `CET4_1/2/3.json` | 7,508 | 4,544 | `GaoZhong_2/3.json` | 1,035 | 5,579 |
| CET6 | `CET6_1/2/3.json` | 5,651 | 3,991 | `CET4_1/2/3.json` | 2,671 | 6,662 |

词汇归属与释义来源是两个独立步骤：

- 单词是否属于 CET4/CET6 核心词，只由目标考试主文件决定。
- 同一拼写的释义、例句、短语和音标，可以从高中、CET4、CET6 八个源文件聚合。
- 低级别来源补充了基础义，不会把 `isCore` 或 `sourceLevel` 改掉。

例如 `paper` 在 CET6 中仍保持 `id: "cet6-paper"`、`sourceLevel: "cet6"`、`isCore: true`，但释义会同时吸收 CET4、高中和 CET6 的记录。

## 原问题与新合并策略

旧脚本按规范化拼写去重后采用“第一条记录胜出”：一旦某个单词进入 `seen_words`，后续文件中的同词记录全部跳过。这正确解决了最终单词重复，却同时丢掉了不同词书中的词性、义项和核心例句。上游源数据本身也按文件拆分且单条 translation 并不完整，例如：

- CET6 的 `paper` 只有动词义“贴壁纸”；
- CET4 包含名词义“纸、文章”；
- 高中记录包含“纸、论文、文件、报纸”和动词义。

新脚本执行以下步骤：

1. 对 `word` 做 Unicode NFKC、trim、lowercase 与空白规范化。
2. 先聚合八个文件中同一规范化拼写的所有记录。
3. 独立生成 CET4/CET6 的核心与补充成员关系。
4. 收集所有来源、所有 `translations`，按标准化词性与释义去重。
5. 按跨来源出现次数、学习级别、常见词性和原始顺序排序。
6. 单来源通常保留一个主要义项；两个来源目标为两个；三个及以上目标为三个，最多六个，每个词性最多两个自动义项。
7. 对 17 个高风险多义词使用可审计的常用义校正表。校正以现有来源为依据；`paper` 的“试卷”按本阶段明确验收标准补入。
8. 生成 `coreMeaning` 供题目使用，生成完整 `meaning`、`meanings`、`meaningsByPos` 供详情和 AI 判题使用。
9. 例句优先选择与核心义和首要词性重合的源例句，再保留其他源例句；不生成虚构例句。
10. 输出构建统计和逐词质量警告。

## 最终数据结构

```json
{
  "id": "cet6-paper",
  "word": "paper",
  "book": "cet6",
  "sourceLevel": "cet6",
  "isCore": true,
  "coreMeaning": "纸；论文；试卷",
  "shortMeaning": "纸；论文；试卷",
  "meaning": "n. 纸；纸张；论文；文章；试卷 v. 给……贴壁纸",
  "meanings": [
    { "pos": "n.", "meaning": "纸；纸张" },
    { "pos": "n.", "meaning": "论文；文章" },
    { "pos": "n.", "meaning": "试卷" },
    { "pos": "v.", "meaning": "给……贴壁纸" }
  ],
  "meaningsByPos": {
    "n.": ["纸；纸张", "论文；文章", "试卷"],
    "v.": ["给……贴壁纸"]
  },
  "examples": []
}
```

为兼容旧代码，每个 `meanings` 项还保留 `partOfSpeech` / `translation` 别名；`shortMeaning` 始终等于 `coreMeaning`，旧字段 `example` / `translation` 始终指向第一条优先例句。

## 稳定 ID 与历史数据

ID 仍由词库名和规范化英文拼写生成，例如 `cet4-abandon`、`cet6-paper`。本次构建与阶段 11 数据逐词比较：CET4 5,579 个、CET6 6,662 个单词的集合、顺序和 ID 变化数均为 0。

用户进度继续使用既有英文键读取。本地数据版本从 7 顺延到 8，只补齐结构，不改变 word progress、错词、收藏、每日统计、复习时间、当日巩固状态、AI 设置、词汇范围或学习模式。

## 构建与报告

```text
python scripts/build-vocabulary.py --download
```

或使用已下载的源目录：

```text
python scripts/build-vocabulary.py --source-dir <json-sentence目录>
```

输出：

- `data/cet4.json`
- `data/cet6.json`
- `data/vocabulary-report.json`
- `data/vocabulary-quality-report.json`
- `docs/VOCABULARY_QUALITY_REPORT.md`

机器报告用于 CI 和逐词复核；Markdown 报告说明汇总指标与高风险回归样本。警告是自动筛选出的复核候选，不代表对应词条已经确认错误。
