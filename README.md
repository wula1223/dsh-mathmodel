# dsh-mathmodel

> 把数学建模竞赛的完整流程（读题 → 求解 → 写论文 → 编译 PDF）装进 DeepSeek Harness，一条命令跑完。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/DeepSeek%20Harness-plugin-green)]()

---

## 这是什么

一个 DeepSeek Harness 插件，把数学建模竞赛的重复劳动自动化。

**解决什么问题**：数学建模竞赛里，把数据算对只是三分之一，剩下三分之二是不停重复的机械活——建目录、写求解脚本、按格式写 14 个 LaTeX 章节、调表格列宽、反复编译修错。这些活每次竞赛都要重做一遍。

**插件做的事**：把这些步骤变成工具调用。你说「开始求解」，剩下的按内置的论文规范自动执行。

**插件不做的事**：不替你思考建模方案，不保证结果正确。它是执行器，不是大脑。

---

## 能力

| 工具 | 作用 |
|---|---|
| `mr_init` | 建工作区：`题目/` `数据/` `求解/` `论文/`，并铺好 18 个模板文件 |
| `mr_problem` | 抽题面：PDF 走 pypdf，DOCX 走 python-docx |
| `mr_run` | 受控跑求解脚本：超时强杀 + 产物回执 |
| `mr_build` | 编译论文：xelatex 两趟，Error 必须为 0 |
| `mr_status` | 扫现状：题目、数据、计划、问题目录、PDF 是否齐 |
| `mr_method` | 取内置论文规范全文（17423 字） |
| `mr_template` | 列/读论文模板 |

外加一个 skill `mathmodel`，把完整的论文规范（摘要字数分配、longtable 列宽公式、9 框流程图、各题型建模步骤）注册进上下文。

---

## 安装

```bash
dsh plugin add github:wula1223/dsh-mathmodel
```

或在 profile 的 `dsh.profile.bundles` 里加入包名后 `pnpm install`。

**环境要求**

| 依赖 | 说明 |
|---|---|
| Node | ≥ 20 |
| Python | 3.10+，需 pandas / numpy / matplotlib |
| LaTeX | TeX Live 或 MiKTeX，必须支持 XeLaTeX |
| 中文字体 | 思源宋体随包提供；系统字体需有 `simkai.ttf` |

第一次用先跑 `mr_build` 验证环境，或手动 `xelatex --version`。

---

## 使用

```
mr_init                                  # 建工作区
（把赛题 PDF 放进 题目/，附件放进 数据/）
mr_problem                               # 抽题面
（按题面写 求解/求解计划.md）
mr_run script="求解/问题一/问题一_XXX.py"  # 逐题求解
（按内置章节结构写 论文/*.tex）
mr_build                                 # 编译出 PDF
```

工作区结构（中文命名）：

```
ws/
├── 题目/           赛题 PDF/DOCX
├── 数据/           附件 xlsx/docx/csv
├── 求解/           生成：求解计划.md、问题一/、问题二/…
│   └── 问题一/
│       ├── 问题一_XXX.py
│       ├── 图片/
│       └── 结果/
└── 论文/           生成：论文.tex + 17 个章节 tex + format.cls + fonts
```

---

## 踩过的坑（插件已内置处理）

这三条都是真跑真题时撞出来的，不是猜的。

### 1. 中文文件名里的下划线会让字印不出来

中文文件名几乎必然带 `_`。LaTeX 里 `_` 是数学下标符，不转义会把后面的中文拖进数学模式，数学字体没有中文字形 —— **Error 数是 0、PDF 照出、页数正常，但那几个字是空白**。

```
问题一_数据分析.py      ← 错，「数据分析」印不出来
问题一\_数据分析.py     ← 对
```

`mr_build` 会扫描日志里的 CJK `Missing character`，检出即判 `ok=false` 并告诉你怎么改。这类假成功比报错危险得多，所以单独一条闸。

### 2. Menlo 字体是 macOS 独占

论文模板 `format.cls` 原本写死 `\setmonofont{Menlo}`，Windows/Linux 上必然缺失，每次编译报 6 条 fontspec Error。已改为 `\IfFontExistsTF` 逐级回退：

```
Menlo（macOS）→ Consolas（Windows）→ DejaVu Sans Mono（Linux）
```

三者都没有就不设等宽字体，宁可没有等宽效果也不再抛错。

### 3. 真实赛题数据常是混合编码

实测真实赛题 CSV 有 UTF-8 与 GBK 混合的情况，单个 GBK 全角符号就会让整个读取崩溃。写求解脚本时用容错读取：

```python
df = pd.read_csv(path, encoding='utf-8', encoding_errors='replace')
```

---

## 验证

```bash
npm test
```

三套验收，共 86 项：

| 套件 | 覆盖 | 项数 |
|---|---|---|
| `accept.mjs` | 工具注册、目录结构、模板完整性、真实 PDF 抽题、编译出 9 页 | 52 |
| `cjk-accept.mjs` | 中文掉字检测、非 CJK 不误判、转义前后对照 | 14 |
| `e2e-b.mjs` | 端到端：真题 → 求解 → 写论文 → 编译出 252KB PDF | 20 |

测试需要 `--import ./test/register-hooks.mjs`：桌面端 asar 内的 `@deepseek-ai/dsh-tools` 没有可解析副本，测试期用 `test/shim-dshtools.mjs` 顶替。shim 复刻了真实宿主的注册规则（缺 `output { schema, render }` 就拒绝）。

---

## 设计取舍

- **方法层与代码分离**：`skill/METHOD.md` 是可替换的规范文本，`templates/` 是可替换的论文模板，`src/` 只负责流程。换规范不动代码。
- **工具只封装已有步骤**：不发明流程环节，每个工具对应「人工本来要手工做的一步」。
- **失败要具体**：字体缺失、中文掉字、编码错误都单列成独立字段并给出解法，而不是笼统报「编译失败」。

第三方来源声明见 [NOTICE](NOTICE)。

---

## License

MIT
