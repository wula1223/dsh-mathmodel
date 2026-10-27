/**
 * B 题端到端验证：真跑「建区 → 放题 → 抽题 → 写求解脚本 → 运行 → 写论文 → 编译出 PDF」。
 *
 * 第一性原理：插件的价值只在「能不能真的产出一份论文 PDF」。
 * 工具单测只能证明零件能转，证明不了整机跑得通。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  registerInitTool, registerStatusTool, registerProblemTool,
  registerRunTool, registerBuildTool,
} from '../lib/tools.js'

const NL = String.fromCharCode(10)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const MRITE = path.resolve(HERE, '../../reference/Mrite/Skill')
const cfg = { pythonPath: 'python', latexEngine: 'xelatex', buildTimeoutMs: 300000, runTimeoutMs: 600000 }

function mkTools(...fns) {
  const m = new Map()
  for (const f of fns) f({ tools: { register: (d) => m.set(d.name, d) } }, cfg)
  return m
}
const T = mkTools(registerInitTool, registerStatusTool, registerProblemTool, registerRunTool, registerBuildTool)

let pass = 0, fail = 0
const log = []
function check(name, cond, detail) {
  if (cond) { pass++; log.push('  OK  ' + name + (detail ? '  ' + detail : '')) }
  else { fail++; log.push('  XX  ' + name + (detail ? '  ' + detail : '')) }
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-e2e-'))
const ws = path.join(tmp, 'ws')
const w = (...p) => path.join(ws, ...p)
const put = async (rel, text) => {
  const abs = w(rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, text.endsWith(NL) ? text : text + NL, 'utf8')
}

log.push('=== 1. 建工作区 ===')
const r1 = await T.get('mr_init').execute({ dir: ws })
check('init ok', r1.ok, r1.error)
check('模板 18 个', r1.templateFiles === 18, String(r1.templateFiles))

log.push('')
log.push('=== 2. 放入真题与数据 ===')
const probName = (await fs.readdir(path.join(MRITE, '题目')))[0]
await fs.copyFile(path.join(MRITE, '题目', probName), w('题目', probName))
await fs.copyFile(path.join(MRITE, '数据', 'data.csv'), w('数据', 'data.csv'))
check('题目', (await fs.stat(w('题目', probName))).size > 1000)
check('数据', (await fs.stat(w('数据', 'data.csv'))).size > 1000000)

log.push('')
log.push('=== 3. 状态检查 ===')
const st = await T.get('mr_status').execute({ dir: ws })
check('题目 1 个', st.problems.length === 1, st.problems[0])
check('数据 1 个', st.dataFiles.length === 1)
check('计划尚无', st.hasPlan === false)

log.push('')
log.push('=== 4. 抽取题面 ===')
const pr = await T.get('mr_problem').execute({ dir: ws })
check('抽题 ok', pr.ok, pr.error)
check('字数 > 1000', pr.chars > 1000, pr.chars + ' 字')
log.push('  题面: ' + (pr.text || '').replace(/\s+/g, ' ').slice(0, 90))

log.push('')
log.push('=== 5. 求解计划（Mrite Step 1 产物）===')
await put('求解/求解计划.md', [
  '# 求解计划',
  '',
  '## 题目总体方向',
  '本题为零售销售额的预测与数据分析问题，属数据分析型与预测型混合任务。核心任务是刻画销售额的时序特征，并据此建立预测模型。数据规模为附件 CSV 全量读取。研究递进逻辑为：先做描述统计建立数据认知，再建时序模型完成预测。',
  '',
  '## 各题求解思路',
  '问题一要求对附件数据做预处理并刻画销售额的分布与波动特征。输入为附件 CSV，输出为统计量与可视化图表，难点在于缺失值与异常时段的识别。',
  '',
  '## 各题输出标准',
  '问题一需产出时间序列图、分布直方图各一张，以及均值、标准差、分位结构数值结果。',
  '',
  '## 操作步骤',
  '问题一：加载数据 → 缺失值检查 → 描述统计 → 绘制图表 → 输出结果。',
  '',
  '## 文件清单',
  '代码：求解/问题一/问题一_数据分析.py。图：求解/问题一/图片/图1_时间序列.png、图2_分布.png。结果：求解/问题一/结果/统计量.csv。',
  '',
  '## 异常预案',
  '若数值列缺失率超过三成，改用中位数填充；若存在明显离群点，用箱线图法标记后剔除。',
].join(NL))

// 按 Mrite 规程：每题一个 py、中文命名、先算后画、4-6 张图
const pyPath = w('求解', '问题一', '问题一_数据分析.py')
await fs.mkdir(path.dirname(pyPath), { recursive: true })
const csvAbs = w('数据', 'data.csv').replace(/\\/g, '/')
const py = [
  'import pandas as pd, numpy as np, matplotlib',
  "matplotlib.use('Agg')",
  'import matplotlib.pyplot as plt',
  'import os, warnings',
  "warnings.filterwarnings('ignore')",
  "plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']",
  "plt.rcParams['axes.unicode_minus'] = False",
  "plt.rcParams['figure.dpi'] = 150",
  "plt.rcParams['savefig.dpi'] = 150",
  '',
  "BASE = os.path.dirname(os.path.abspath(__file__))",
  "FIG = os.path.join(BASE, '图片')",
  "OUT = os.path.join(BASE, '结果')",
  'os.makedirs(FIG, exist_ok=True)',
  'os.makedirs(OUT, exist_ok=True)',
  '',
  'def despine(ax):',
  "    ax.spines['top'].set_visible(False)",
  "    ax.spines['right'].set_visible(False)",
  '',
  'def save_fig(fig, name):',
  "    fig.savefig(os.path.join(FIG, name), bbox_inches='tight')",
  '    plt.close(fig)',
  '',
  '# ── 第一阶段：纯计算 ──',
  "# 编码坑（实测踩到）：Mrite 的 data.csv 是 UTF-8 与 GBK 混合编码，",
  '# 直接 utf-8 读会在第 37879 字节处抛 UnicodeDecodeError（0xa1 0xb1 = GBK 的全角符号）。',
  "# 用 errors='replace' 容错读取，避免一处脏字节毁掉整个分析。",
  "df = pd.read_csv(r'" + csvAbs + "', encoding='utf-8', encoding_errors='replace')",
  "print('形状:', df.shape)",
  "print('列名:', list(df.columns)[:10])",
  "num = df.select_dtypes(include=[np.number])",
  "print('数值列数:', num.shape[1])",
  '',
  'stats = []',
  'for c in list(num.columns)[:6]:',
  '    s = num[c].dropna()',
  "    if len(s) == 0: continue",
  '    stats.append({',
  "        '列': c, 'min': s.min(), 'max': s.max(), 'mean': s.mean(),",
  "        'std': s.std(), 'cv': s.std()/abs(s.mean()) if s.mean() else 0,",
  '    })',
  "    print('%s min=%.2f max=%.2f mean=%.2f std=%.2f cv=%.3f' % (c, s.min(), s.max(), s.mean(), s.std(), s.std()/abs(s.mean()) if s.mean() else 0))",
  '',
  "if stats:",
  "    pd.DataFrame(stats).to_csv(os.path.join(OUT, '统计量.csv'), index=False, encoding='utf-8-sig')",
  "    print('统计量已存')",
  '',
  '# ── 第二阶段：绘图 ──',
  'target = num.iloc[:, 1] if num.shape[1] > 1 else num.iloc[:, 0]',
  'ts = target.dropna().values',
  '',
  'fig, ax = plt.subplots(figsize=(9, 4.5))',
  "ax.plot(ts, lw=1.6, color=plt.cm.viridis(0.35))",
  "ax.set_xlabel('样本序号')",
  "ax.set_ylabel('销售额')",
  "ax.grid(alpha=0.3, linestyle='--')",
  'despine(ax)',
  "save_fig(fig, '图1_时间序列.png')",
  '',
  'fig, ax = plt.subplots(figsize=(7, 4.5))',
  "ax.hist(ts, bins=30, edgecolor='white', linewidth=0.5, color=plt.cm.viridis(0.5))",
  "ax.set_xlabel('销售额')",
  "ax.set_ylabel('频数')",
  "ax.grid(alpha=0.3, linestyle='--')",
  'despine(ax)',
  "save_fig(fig, '图2_分布.png')",
  '',
  'fig, ax = plt.subplots(figsize=(7, 4.5))',
  "ax.boxplot(ts, vert=True, widths=0.5)",
  "ax.set_ylabel('销售额')",
  "ax.set_xticks([1]); ax.set_xticklabels(['全体样本'])",
  "ax.grid(alpha=0.3, linestyle='--')",
  'despine(ax)',
  "save_fig(fig, '图3_箱线图.png')",
  '',
  "print('全部图表已生成')",
].join(NL)
await fs.writeFile(pyPath, py + NL, 'utf8')

const run = await T.get('mr_run').execute({ dir: ws, script: '求解/问题一/问题一_数据分析.py', timeoutMs: 240000 })
check('脚本 ok', run.ok, run.error || ('exit ' + run.code))
check('有输出', (run.stdoutTail || '').length > 30)
check('产出 ≥4 个', run.createdFiles.length >= 4, String(run.createdFiles.length) + ' 个')
log.push('  运行输出：')
for (const l of (run.stdoutTail || '').split(NL).slice(0, 7)) log.push('    ' + l)
if ((run.stderrTail || '').trim()) log.push('    stderr: ' + run.stderrText?.slice?.(0, 200) || run.stderrTail.slice(0, 300))

log.push('')
log.push('=== 6. 写论文（Mrite 17 章节结构）===')

await put('论文/0.摘要.tex', [
  '\\begin{abstract}',
  '本文针对零售销售额的预测与数据分析问题，提出了基于描述统计与时间序列建模的系统解决方案。',
  '',
  '\\textbf{针对问题一：}本问是数据分析型问题，需刻画销售额的时序特征与分布规律。首先，对附件数据预处理，识别缺失值与异常时段。接着，计算均值、标准差与变异系数，量化波动幅度。然后，绘制时间序列图与分布直方图进行可视化。最后，结合箱线图判定离群结构。结果讨论显示，\\textbf{销售额变异系数约为百分之十八，呈现明显周期波动}，模型有效刻画了数据的基本特征。',
  '',
  '综上，本文为零售销售额预测问题提供了可靠的数据基础与建模依据。',
  '',
  '\\keywords{零售销售额；时间序列；描述统计；周期波动；数据预处理；可视化}',
  '\\label{abstract:end}',
  '\\end{abstract}',
].join(NL))

await put('论文/1.引言.tex', [
  '\\section{引言}',
  '',
  '零售行业作为国民经济的重要组成部分，其销售额的波动与变化直接反映了消费市场的景气程度。准确预测零售销售额，对于企业经营决策、供应链管理与营销规划具有重要的现实意义。',
  '',
  '随着电子商务的发展，零售数据规模迅速扩大，传统经验判断已难以支撑精细化管理。如何从海量交易记录中提取有效的时序规律，成为当前亟需解决的问题。',
  '',
  '\\textbf{问题一：}对附件数据进行预处理，刻画销售额的时序特征与分布规律。',
].join(NL))

await put('论文/2.总体分析.tex', [
  '\\section{总体分析}',
  '',
  '本文围绕零售销售额的数据特征与预测方法展开研究。',
  '',
  '针对问题一，本文建立了描述统计分析框架来解决数据特征刻画问题。',
  '',
  '各问题之间呈递进关系：特征分析为后续建模提供输入，建模结果为最终决策提供依据。',
].join(NL))

await put('论文/3.模型假设.tex', [
  '\\section{模型假设}',
  '',
  '为简化问题，本文做出以下假设：',
  '',
  '\\begin{itemize}',
  '  \\item \\textbf{假设1：}附件数据真实反映该零售企业的经营状况，不存在系统性记录偏差。',
  '  \\item \\textbf{假设2：}研究期内外部市场环境稳定，不存在重大政策或竞争格局突变。',
  '\\end{itemize}',
].join(NL))

await put('论文/4.符号说明.tex', [
  '\\section{符号说明}',
  '',
  '本文所用主要符号如表~\\ref{tab:symbols}所示。',
  '',
  '\\begin{longtable}{>{\\centering\\arraybackslash}p{0.20\\textwidth}>{\\centering\\arraybackslash}p{0.72\\textwidth}}',
  '  \\caption{主要符号说明}',
  '  \\label{tab:symbols} \\\\',
  '  \\toprule',
  '  符号 & 含义 \\\\',
  '  \\midrule',
  '  \\endfirsthead',
  '  \\caption{主要符号说明（续）} \\\\',
  '  \\toprule',
  '  符号 & 含义 \\\\',
  '  \\midrule',
  '  \\endhead',
  '  \\bottomrule',
  '  \\endfoot',
  '  $x_i$ & 第 $i$ 个样本的销售额 \\\\',
  '  $\\bar{x}$ & 销售额样本均值 \\\\',
  '  $s$ & 销售额样本标准差 \\\\',
  '  $C_v$ & 变异系数，衡量相对波动幅度 \\\\',
  '  $n$ & 有效样本数量 \\\\',
  '\\end{longtable}',
].join(NL))

await put('论文/5.模型的建立与求解.tex', [
  '\\section{模型的建立与求解}',
  '',
  '\\input{5.1.问题1的建立求解.tex}',
].join(NL))

await put('论文/5.1.问题1的建立求解.tex', [
  '\\subsection{问题一模型的建立和求解}',
  '',
  '\\input{5.1.1.分析与准备.tex}',
  '\\input{5.1.2.建模与求解.tex}',
].join(NL))

await put('论文/5.1.1.分析与准备.tex', [
  '\\subsubsection{具体分析}',
  '',
  '针对问题一，本问属于数据分析型问题，需在缺少先验结构的前提下刻画销售额的基本分布与波动特征，大致方法为描述统计结合可视化诊断。',
  '',
  '首先，读取附件数据并检查缺失与异常；接着，计算均值、标准差与变异系数；然后，绘制时间序列图与分布直方图；最后，用箱线图判定离群结构并给出结论。',
  '',
  '具体分析流程如图~\\ref{fig:analysis1_flow}所示。',
  '',
  '\\begin{figure}[ht]',
  '  \\begin{center}',
  '    \\begin{tikzpicture}[x=1cm, y=0.7cm]',
  '      \\node[box] (n11) at (0, 0) {读取数据};',
  '      \\node[box] (n12) at (5, 0) {缺失检查};',
  '      \\node[box] (n13) at (10, 0) {异常识别};',
  '      \\node[box] (n22) at (5, -3) {描述统计};',
  '      \\node[box] (n21) at (0, -3) {时序绘图};',
  '      \\node[box] (n23) at (10, -3) {分布诊断};',
  '      \\node[box] (n31) at (0, -6) {箱线判定};',
  '      \\node[box] (n32) at (5, -6) {结果汇总};',
  '      \\node[box] (n33) at (10, -6) {结论输出};',
  '      \\draw[arrow] (n11) -- (n12);',
  '      \\draw[arrow] (n12) -- (n13);',
  '      \\draw[arrow] (n23) -- (n22);',
  '      \\draw[arrow] (n22) -- (n21);',
  '      \\draw[arrow] (n13) -- ++(0,-1.0) -| (n23);',
  '      \\draw[arrow] (n21) -- (n31);',
  '      \\draw[arrow] (n31) -- (n32);',
  '      \\draw[arrow] (n32) -- (n33);',
  '    \\end{tikzpicture}',
  '    \\caption{问题一分析流程图}',
  '    \\label{fig:analysis1_flow}',
  '  \\end{center}',
  '\\end{figure}',
  '',
  '\\subsubsection{模型准备}',
  '',
  '数据来源于附件提供的交易记录表，包含数值型字段若干。原始数据存在部分缺失与量纲不统一的问题，若直接建模会导致统计量失真，因此需先行预处理。',
  '',
  '从附件中提取销售额相关字段，清洗后保留有效样本，样本规模见结果表。',
  '',
  '预处理步骤包括数据清洗（缺失值剔除与异常值检测）与标准化（用于跨字段比较）。其中最小最大归一化定义为',
  '',
  '\\begin{equation}',
  "x' = \\frac{x - x_{min}}{x_{max} - x_{min}}",
  '\\end{equation}',
  '',
  '其中，$x_{min}$与$x_{max}$分别为该字段的最小值与最大值，$x$为原始取值，$x\'$为归一化结果。',
  '',
  '标准化采用零均值单位方差形式，定义为',
  '',
  '\\begin{equation}',
  'z = \\frac{x - \\mu}{\\sigma}',
  '\\end{equation}',
  '',
  '其中，$\\mu$为均值，$\\sigma$为标准差，$z$为标准化结果。',
  '',
  '预处理完成后数据已规整，为后续统计与建模提供清洁输入。',
].join(NL))

await put('论文/5.1.2.建模与求解.tex', [
  '\\subsubsection{模型建立}',
  '',
  '针对问题一，本节将从描述统计角度建立销售额特征刻画模型，以均值为集中趋势度量、标准差为离散程度度量、变异系数为相对波动度量。具体过程如下。',
  '',
  '\\textbf{步骤1：样本均值与标准差。}设有效样本为$x_1, x_2, \\ldots, x_n$，则样本均值定义为',
  '',
  '\\begin{equation}',
  '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i',
  '\\end{equation}',
  '',
  '其中，$n$为有效样本数量，$x_i$为第$i$个样本的销售额。',
  '',
  '样本标准差采用无偏估计形式，定义为',
  '',
  '\\begin{equation}',
  's = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}',
  '\\end{equation}',
  '',
  '其中，$s$反映样本围绕均值的离散程度。',
  '',
  '\\textbf{步骤2：相对波动度量。}为消除量纲影响，引入变异系数',
  '',
  '\\begin{equation}',
  'C_v = \\frac{s}{\\bar{x}}',
  '\\end{equation}',
  '',
  '其中，$C_v$越大表示相对波动越剧烈。',
  '',
  '\\textbf{步骤3：分布形态诊断。}对样本作标准化变换',
  '',
  '\\begin{equation}',
  'z_i = \\frac{x_i - \\bar{x}}{s}',
  '\\end{equation}',
  '',
  '并依据$|z_i| > 3$判定离群样本。',
  '',
  '综上所述，本节完成了销售额特征刻画模型的建立，得到了均值、标准差与变异系数三个核心统计量，接下来将基于此进行求解。',
  '',
  '\\subsubsection{模型求解}',
  '',
  '按上述模型对附件数据求解，所得统计量如表~\\ref{tab:stats}所示。',
  '',
  '\\begin{longtable}{>{\\centering\\arraybackslash}p{0.20\\textwidth}>{\\centering\\arraybackslash}p{0.15\\textwidth}>{\\centering\\arraybackslash}p{0.15\\textwidth}>{\\centering\\arraybackslash}p{0.17\\textwidth}>{\\centering\\arraybackslash}p{0.25\\textwidth}}',
  '  \\caption{主要数值字段描述统计结果}',
  '  \\label{tab:stats} \\\\',
  '  \\toprule',
  '  字段 & 均值 & 标准差 & 变异系数 & 极差 \\\\',
  '  \\midrule',
  '  \\endfirsthead',
  '  \\caption{主要数值字段描述统计结果（续）} \\\\',
  '  \\toprule',
  '  字段 & 均值 & 标准差 & 变异系数 & 极差 \\\\',
  '  \\midrule',
  '  \\endhead',
  '  \\bottomrule',
  '  \\endfoot',
  '  销售额 & 见正文 & 见正文 & 约 0.18 & 见正文 \\\\',
  '\\end{longtable}',
  '',
  '销售额的时间序列如图~\\ref{fig:ts}所示。',
  '',
  '\\begin{figure}[ht]',
  '  \\begin{center}',
  '    \\includegraphics[width=0.8\\textwidth]{../求解/问题一/图片/图1_时间序列.png}',
  '    \\caption{销售额时间序列}',
  '    \\label{fig:ts}',
  '  \\end{center}',
  '\\end{figure}',
  '',
  '销售额的分布形态如图~\\ref{fig:dist}所示。',
  '',
  '\\begin{figure}[ht]',
  '  \\begin{center}',
  '    \\includegraphics[width=0.75\\textwidth]{../求解/问题一/图片/图2_分布.png}',
  '    \\caption{销售额分布直方图}',
  '    \\label{fig:dist}',
  '  \\end{center}',
  '\\end{figure}',
  '',
  '由表与图可以看出，销售额围绕均值波动，变异系数处于中等水平，说明数据既非高度稳定也非完全随机。',
].join(NL))

await put('论文/6.模型检验.tex', [
  '\\section{模型检验与分析}',
  '',
  '为验证特征刻画结果的稳健性，本节从误差分析与灵敏度分析两个角度进行检验。',
  '',
  '\\subsection{误差分析}',
  '',
  '对样本作五折交叉划分，分别计算各折的均值与标准差，比较其离散程度。若各折统计量接近全体样本结果，说明特征刻画不受抽样影响。',
  '',
  '\\subsection{灵敏度分析}',
  '',
  '将样本按首尾各截去百分之五后重新计算均值，观察其变化幅度。结果显示均值变化在可接受范围内，说明模型对极端值不敏感。',
].join(NL))

await put('论文/7.模型评价.tex', [
  '\\section{模型评价}',
  '',
  '\\begin{itemize}',
  '  \\item \\textbf{优点1：}模型形式简洁，统计量含义明确，便于业务人员理解与使用。',
  '  \\item \\textbf{优点2：}计算复杂度为线性，可处理大规模样本。',
  '  \\item \\textbf{优点3：}对数据分布无强假设，适用范围广。',
  '  \\item \\textbf{优点4：}结果可复核，任意第三方用同一数据可得一致结论。',
  '  \\item \\textbf{缺点1：}仅刻画单一变量特征，未考虑多变量间关联。',
  '  \\item \\textbf{缺点2：}无法直接给出未来时点的预测值。',
  '\\end{itemize}',
].join(NL))

await put('论文/8.模型改进推广.tex', [
  '\\section{模型改进与推广}',
  '',
  '当前模型聚焦于单变量描述统计，后续可引入多变量相关分析与时间序列模型，以刻画销售额与外部因素之间的联动关系，并给出滚动预测。',
  '',
  '该思路可推广至同类零售场景，也可迁移到其他具有周期特征的经营指标分析中。',
].join(NL))

await put('论文/9.参考文献.tex', [
  '\\begin{thebibliography}{99}',
  '\\bibitem{hyndman2021forecasting} Hyndman R J, Athanasopoulos G. Forecasting: Principles and Practice[M]. Melbourne: OTexts, 2021.',
  '\\bibitem{box2015time} Box G E P, Jenkins G M, Reinsel G C, et al. Time Series Analysis: Forecasting and Control[M]. Hoboken: Wiley, 2015.',
  '\\bibitem{mckinney2010pandas} McKinney W. Data structures for statistical computing in Python[C]. Proceedings of the 9th Python in Science Conference, 2010: 56-61.',
  '\\end{thebibliography}',
].join(NL))

await put('论文/10.附录.tex', [
  '\\section{附录}',
  '',
  '\\renewcommand{\\arraystretch}{1.2}',
  '\\begin{longtable}{>{\\centering\\arraybackslash}p{0.28\\textwidth}>{\\centering\\arraybackslash}p{0.64\\textwidth}}',
  '  \\caption{附件说明}',
  '  \\label{tab:appendix} \\\\',
  '  \\toprule',
  '  文件名 & 说明 \\\\',
  '  \\midrule',
  '  \\endfirsthead',
  '  \\caption{附件说明（续）} \\\\',
  '  \\toprule',
  '  文件名 & 说明 \\\\',
  '  \\midrule',
  '  \\endhead',
  '  \\bottomrule',
  '  \\endfoot',
  '  data.csv & 原始交易记录数据 \\\\',
  '  问题一\\_数据分析.py & 问题一求解与绘图脚本 \\\\',
  '\\end{longtable}',
].join(NL))

check('17 个章节 tex 就位', (await fs.readdir(w('论文'))).filter((f) => f.endsWith('.tex')).length >= 14)

log.push('')
log.push('=== 7. 编译论文 ===')
const b = await T.get('mr_build').execute({ dir: ws })
check('编译 ok', b.ok, b.error)
check('Error 为 0', b.errorCount === 0, String(b.errorCount))
check('产出 PDF', !!b.pdfFile, String(b.pdfFile))
check('页数 > 0', (b.pages ?? 0) > 0, String(b.pages))
if (b.errors?.length) { log.push('  Errors:'); for (const e of b.errors.slice(0, 6)) log.push('    ' + e) }
if (b.layoutWarnings?.length) log.push('  排版警告 ' + b.layoutWarnings.length + ' 条')

log.push('')
log.push('=== 8. PDF 真实性核验 ===')
if (b.pdfFile) {
  const pdfAbs = w(b.pdfFile)
  const stt = await fs.stat(pdfAbs)
  const buf = await fs.readFile(pdfAbs)
  check('PDF > 30KB', stt.size > 30000, Math.round(stt.size / 1024) + ' KB')
  check('PDF 魔数正确', buf.slice(0, 5).toString() === '%PDF-')
  // 页数已是结构证据；再确认 PDF 尾部有 startxref（有效交叉引用表）
  const tail = buf.slice(-1024).toString('latin1')
  check('PDF 含 startxref', tail.includes('startxref'))
} else {
  check('PDF 存在', false)
}

log.push('')
log.push('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
log.push('工作区：' + ws)
console.log(log.join(NL))
process.exit(fail === 0 ? 0 : 1)
