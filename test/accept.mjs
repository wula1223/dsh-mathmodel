/**
 * 端到端验收：用 Mrite 自带的 B 题真题跑一遍封装后的插件。
 *
 * 为什么用 B 题：它是 Mrite 仓库里唯一配齐「题目 PDF + 数据 CSV + 现成论文」的赛题，
 * 结论可对照——Mrite 自己的论文.pdf 就是标准答案。
 *
 * 验收项（全部对应 Mrite 规程里的硬约束）：
 *   1. mr_init 建出的目录结构与 CLAUDE.md「项目结构」一致
 *   2. 论文模板 17 个 tex + format.cls + 字体全部就位
 *   3. mr_problem 能从真实 PDF 抽出题面文字
 *   4. mr_build 能编译 Mrite 自带模板（xelatex × 2，Error=0）
 *   5. mr_method 原样返回 CLAUDE.md，字符数与源文件一致
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { registerInitTool, registerStatusTool, registerProblemTool, registerBuildTool, registerMethodTool, registerTemplateTool } from '../lib/tools.js'

const NL = String.fromCharCode(10)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const MRITE_SRC = path.resolve(HERE, '../../reference/Mrite')

let pass = 0
let fail = 0
const lines = []

function check(name, cond, detail) {
  if (cond) { pass++; lines.push('  OK  ' + name + (detail ? '  ' + detail : '')) }
  else { fail++; lines.push('  XX  ' + name + (detail ? '  ' + detail : '')) }
}

const config = {
  pythonPath: 'python',
  latexEngine: 'xelatex',
  buildTimeoutMs: 300000,
  runTimeoutMs: 600000,
}

function collect(register, ctx, cfg) {
  const tools = new Map()
  register({ tools: { register: (d) => tools.set(d.name, d) } }, cfg)
  return tools
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mrite-accept-'))
  const ws = path.join(tmp, 'ws')

  const init = collect(registerInitTool, null, config).get('mr_init')
  const status = collect(registerStatusTool, null, config).get('mr_status')
  const problem = collect(registerProblemTool, null, config).get('mr_problem')
  const build = collect(registerBuildTool, null, config).get('mr_build')
  const method = collect(registerMethodTool, null, config).get('mr_method')
  const template = collect(registerTemplateTool, null, config).get('mr_template')

  lines.push('=== 1. 工具注册 ===')
  for (const [n, t] of [['mr_init', init], ['mr_status', status], ['mr_problem', problem], ['mr_build', build], ['mr_method', method], ['mr_template', template]]) {
    check(n + ' 已注册', !!t)
  }

  lines.push('')
  lines.push('=== 2. mr_init 建目录 ===')
  const r1 = await init.execute({ dir: ws })
  check('建区成功', r1.ok, r1.error)
  for (const d of ['题目', '数据', '求解', '论文']) {
    const exists = await fs.stat(path.join(ws, d)).then((s) => s.isDirectory()).catch(() => false)
    check('目录 ' + d + '/', exists)
  }
  check('模板文件数 ≥18', r1.templateFiles >= 18, '实得 ' + r1.templateFiles)

  lines.push('')
  lines.push('=== 3. 论文模板完整性（对照 CLAUDE.md 要求的 17 个 tex） ===')
  const paperFiles = await fs.readdir(path.join(ws, '论文'))
  const required = [
    '论文.tex', 'format.cls',
    '0.摘要.tex', '1.引言.tex', '2.总体分析.tex', '3.模型假设.tex', '4.符号说明.tex',
    '5.模型的建立与求解.tex', '5.1.问题1的建立求解.tex',
    '5.1.1.分析与准备.tex', '5.1.2.建模与求解.tex',
    '6.模型检验.tex', '7.模型评价.tex', '8.模型改进推广.tex',
    '9.参考文献.tex', '10.附录.tex',
  ]
  for (const f of required) {
    check('模板 ' + f, paperFiles.includes(f))
  }
  const fonts = await fs.readdir(path.join(ws, '论文', 'fonts')).catch(() => [])
  check('思源宋体 2 个', fonts.filter((f) => f.endsWith('.otf')).length === 2, fonts.join('、'))

  lines.push('')
  lines.push('=== 4. 幂等：再跑一次 mr_init 不覆盖 ===')
  const r1b = await init.execute({ dir: ws })
  check('二次 init 仍 ok', r1b.ok)
  check('二次 init 模板数 0', r1b.templateFiles === 0, '实得 ' + r1b.templateFiles)

  lines.push('')
  lines.push('=== 5. mr_status 扫现状 ===')
  const s0 = await status.execute({ dir: ws })
  check('status ok', s0.ok)
  check('初始无题目', s0.problems.length === 0)
  check('初始无计划', s0.hasPlan === false)
  check('初始有论文.tex', s0.mainTexExists === true)

  lines.push('')
  lines.push('=== 6. mr_problem 从真实 PDF 抽题面 ===')
  // 放 Mrite 自带的 B 题 PDF
  const srcPdf = path.join(MRITE_SRC, 'Skill', '题目', '题目B：零售销售额的预测与数据分析.pdf')
  const pdfExists = await fs.stat(srcPdf).then(() => true).catch(() => false)
  check('源 PDF 存在', pdfExists, srcPdf)
  if (pdfExists) {
    await fs.copyFile(srcPdf, path.join(ws, '题目', '题目B.pdf'))
    const p = await problem.execute({ dir: ws })
    check('抽题成功', p.ok, p.error)
    check('题面字数 > 500', p.chars > 500, '实得 ' + p.chars)
    check('题面含中文', /[\u4e00-\u9fa5]/.test(p.text))
    lines.push('  题面前 120 字：' + (p.text || '').replace(/\s+/g, ' ').slice(0, 120))
  }

  lines.push('')
  lines.push('=== 7. mr_method 原样返回 CLAUDE.md ===')
  const m = await method.execute({})
  const srcMethod = await fs.readFile(path.resolve(HERE, '../skill/METHOD.md'), 'utf8')
  check('method ok', m.ok)
  check('字符数与源文件一致', m.chars === srcMethod.length, m.chars + ' vs ' + srcMethod.length)
  check('内容逐字相同', m.text === srcMethod)
  check('章节索引非空', m.sections.length > 5, m.sections.length + ' 个标题')
  check('含「全自动模式」', m.text.includes('全自动模式'))
  check('含「摘要」字数约束', m.text.includes('≤900字'))
  check('含列宽公式', m.text.includes('1.04'))

  lines.push('')
  lines.push('=== 8. mr_template 读模板 ===')
  const tl = await template.execute({})
  check('列出模板文件', tl.ok && tl.files.length >= 18, '实得 ' + (tl.files ? tl.files.length : 0))
  const tf = await template.execute({ file: '5.1.1.分析与准备.tex' })
  check('读取单文件', tf.ok && tf.content.length > 100, '实得 ' + (tf.content ? tf.content.length : 0) + ' 字')

  lines.push('')
  lines.push('=== 9. mr_build 编译 Mrite 自带模板 ===')
  const b = await build.execute({ dir: ws })
  check('编译成功', b.ok, b.error)
  check('Error 数为 0', b.errorCount === 0, '实得 ' + b.errorCount)
  check('产出 PDF', !!b.pdfFile, String(b.pdfFile))
  check('页数 > 0', (b.pages ?? 0) > 0, '实得 ' + b.pages)
  if (b.errors && b.errors.length) {
    for (const e of b.errors.slice(0, 5)) lines.push('    E ' + e)
  }

  lines.push('')
  lines.push('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
  console.log(lines.join(NL))

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
