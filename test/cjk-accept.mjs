import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { detectMissingCJK, detectMissingFonts } from '../lib/exec.js'

const NL = String.fromCharCode(10)
let pass = 0, fail = 0
const log = []
const check = (n, c, d) => { if (c) { pass++; log.push('  OK  ' + n) } else { fail++; log.push('  XX  ' + n + (d ? '  ' + d : '')) } }

// 真实样本：未转义下划线导致的中文掉字
const real = [
  'Missing character: There is no 数 (U+6570) in font Times New Roman/OT:script=lat',
  'n;language=dflt;mapping=tex-text;!',
  'Missing character: There is no 据 (U+636E) in font Times New Roman/OT:script=lat',
  'Missing character: There is no 分 (U+5206) in font Times New Roman/OT:script=lat',
  'Missing character: There is no 析 (U+6790) in font Times New Roman/OT:script=lat',
].join(NL)

log.push('=== 中文掉字检测 ===')
const got = detectMissingCJK(real)
check('检出 4 个字', got.length === 4, JSON.stringify(got))
check('含「数」', got.includes('数'))
check('含「析」', got.includes('析'))

// 不应误判：非 CJK 的 missing character（比如希腊字母缺失）不算
const nonCjk = 'Missing character: There is no α (U+03B1) in font SomeFont'
check('非 CJK 不误判', detectMissingCJK(nonCjk).length === 0, JSON.stringify(detectMissingCJK(nonCjk)))

// 不应误判：正常日志
check('正常日志不误判', detectMissingCJK('Output written on 论文.pdf (9 pages).').length === 0)

log.push('')
log.push('=== 字体缺失检测（回归） ===')
const mf = 'The font "Menlo" cannot be found'
check('Menlo 检出', detectMissingFonts(mf).includes('Menlo'))
check('正常不误判', detectMissingFonts('Output written on a.pdf').length === 0)

log.push('')
log.push('=== 端到端：真跑一次含下划线的论文 ===')

const { registerInitTool, registerBuildTool } = await import('../lib/tools.js')
const cfg = { pythonPath: 'python', latexEngine: 'xelatex', buildTimeoutMs: 300000, runTimeoutMs: 600000 }
const mk = (f) => { const m = new Map(); f({ tools: { register: (d) => m.set(d.name, d) } }, cfg); return m }
const init = mk(registerInitTool).get('mr_init')
const build = mk(registerBuildTool).get('mr_build')

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-cjk-'))
const ws = path.join(tmp, 'ws')
await init.execute({ dir: ws })

// 用空模板直接编译（应成功）
const ok1 = await build.execute({ dir: ws })
check('空模板编译成功', ok1.ok, ok1.error)
check('空模板无掉字', ok1.missingCjk.length === 0)

// 注入一行未转义下划线的中文 → 必须被判失败
const appTex = path.join(ws, '论文', '10.附录.tex')
await fs.writeFile(appTex, [
  '\\section{附录}',
  '问题一_数据分析.py 的下划线没有转义',
].join(NL) + NL, 'utf8')

const ok2 = await build.execute({ dir: ws })
check('含未转义下划线 → 判失败', ok2.ok === false, 'ok=' + ok2.ok)
check('检出掉字', ok2.missingCjk.length > 0, JSON.stringify(ok2.missingCjk))
check('错误信息给了解法', (ok2.error || '').includes('\\_') || (ok2.error || '').includes('转义'), ok2.error)
log.push('  检出：' + ok2.missingCjk.join('、'))

// 修正为转义后 → 必须判成功
await fs.writeFile(appTex, [
  '\\section{附录}',
  '问题一\\_数据分析.py 的下划线已转义',
].join(NL) + NL, 'utf8')
const ok3 = await build.execute({ dir: ws })
check('转义后判成功', ok3.ok === true, ok3.error)
check('无掉字', ok3.missingCjk.length === 0)

log.push('')
log.push('=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
console.log(log.join(NL))

await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined)
process.exit(fail === 0 ? 0 : 1)
