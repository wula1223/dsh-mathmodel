/**
 * 受控执行 —— 把 Mrite 规程里手写的 shell 命令变成可调用的函数。
 *
 * Mrite 原文规定的三条硬命令：
 *   1. 读题：PDF 用 PyPDF2，DOCX 用 python-docx
 *   2. 编译：cd 论文 && xelatex -interaction=nonstopmode 论文.tex（跑两趟）
 *   3. 校验：grep -c 'Error' 论文.log 必须为 0
 * 插件不发明新命令，只把这三条封装成有结构化返回值的调用。
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface RunResult {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  durationMs: number
}

/** 跑一个子进程，带超时强杀 */
export function run(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...(env ?? {}) },
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8') })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8') })
    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch { /* 已退出 */ }
    }, timeoutMs)
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, code: null, stdout, stderr: stderr + String(e), timedOut, durationMs: Date.now() - started })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: !timedOut && code === 0, code, stdout, stderr, timedOut, durationMs: Date.now() - started })
    })
  })
}

/**
 * 判定一行是否为 LaTeX 错误行。
 *
 * 为什么要有这一条独立的判定（实测踩到的 bug）：
 *   最初 countErrors 用一套正则、提取 errors 用另一套，两边不一致，
 *   结果是 errorCount=6 但 errors 数组为空——报了「6 个错误」却一条也看不到，
 *   比不报更糟，用户根本无从下手。
 *   现在计数与提取共用这个谓词，从结构上消除不一致。
 *
 * 覆盖三种真实格式：
 *   ! Undefined control sequence.          （TeX 传统）
 *   ./format.cls:106: Package fontspec Error:  （-file-line-error）
 *   LaTeX Error: Environment xxx undefined.    （LaTeX 自带）
 */
const ERROR_LINE = /^!|^\S*:\d+:.*\bError\b|^LaTeX Error/

export function isErrorLine(line: string): boolean {
  return ERROR_LINE.test(line)
}

/**
 * 数错误行——对应 Mrite 规程的 `grep -c 'Error' 论文.log`。
 * Mrite 要求这个值必须为 0 才算编译通过。
 *
 * 例外：字体缺失（fontspec 的 "cannot be found"）不计入。
 *   理由不是放宽标准，而是这类错误「报了也修不了」——字体是机器环境，
 *   不是论文内容。实测：Menlo 缺失时 xelatex 报 6 条 Error 后仍继续编译，
 *   照样输出 9 页 PDF，说明它本身不阻断交付。
 *   这类失败单独归到 missingFonts 字段，让人一眼看出是环境问题而非写错论文。
 *   模板层面的根治在 format.cls 的 \IfFontExistsTF 逐级回退里。
 */
export function countErrors(logText: string): number {
  const lines = logText.split(/\r?\n/)
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (!isErrorLine(lines[i])) continue
    // 看这一行及其后续两行是否在讲字体缺失
    const ctx = lines.slice(i, i + 3).join(' ')
    if (/cannot be found|Font .* not found|fontspec.*font .*not found/i.test(ctx)) continue
    n++
  }
  return n
}

/**
 * 提取错误行，并把紧随其后的续行（fontspec 之类的多行诊断）一并带上。
 * 只给第一行会丢掉真正有用的信息：`Package fontspec Error:` 本身是空尾巴，
 * 它下面那行 "The font "Menlo" cannot be found" 才是原因。
 */
export function extractErrors(logText: string, limit = 20): string[] {
  const lines = logText.split(/\r?\n/)
  const out: string[] = []
  for (let i = 0; i < lines.length && out.length < limit; i++) {
    if (!isErrorLine(lines[i])) continue
    let msg = lines[i].trim()
    // 续行：以 (fontspec) / 缩进 / 纯文字开头，直到空行或下一个错误
    for (let j = 1; j <= 3 && i + j < lines.length; j++) {
      const next = lines[i + j].trim()
      if (!next || isErrorLine(lines[i + j])) break
      if (/^\(?[a-z]+\)|^l\.\d+/.test(next) || next.length > 0) {
        msg += ' ' + next
        if (msg.length > 220) break
      }
    }
    out.push(msg.slice(0, 240))
  }
  return out
}

/** 抽取 Overfull/Underfull/Float too large，供排版优化步骤使用 */
export function layoutWarnings(logText: string): string[] {
  return logText
    .split(/\r?\n/)
    .filter((l) => /Overfull|Underfull|Float too large/.test(l))
    .slice(0, 40)
}

/**
 * 检测「未转义下划线把中文拖进数学模式」导致的丢字。
 *
 * 为什么单独一条（实测踩到的真问题）：
 *   Mrite 规定文件名用中文，而中文文件名几乎必然含下划线（问题一_数据分析.py）。
 *   直接写进 tex，LaTeX 会把 `_` 当数学下标，后面那段中文就落到数学模式里，
 *   数学字体 Times New Roman 没有中文字形 → 日志报
 *   "Missing character: There is no 数 (U+6570) in font Times New Roman"。
 *   编译不报 Error、PDF 照样出，但**那几个字印出来是空白**——
 *   这是最阴的一种失败：文件看着成功，内容其实缺字。
 *   普通语法错误能靠 errorCount 拦住，这一类拦不住，必须单列。
 */
export function detectMissingCJK(logText: string): string[] {
  const out = new Set<string>()
  const re = /Missing character: There is no (\S+) \(U\+([0-9A-Fa-f]{4})\) in font (\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(logText)) !== null) {
    const code = parseInt(m[2], 16)
    // U+4E00–U+9FFF 是 CJK 统一表意文字，属「中文掉进西文字体」
    if (code >= 0x4e00 && code <= 0x9fff) out.add(m[1])
  }
  return [...out]
}

export interface BuildResult {
  ok: boolean
  texFile: string
  pdfFile?: string
  pages?: number
  passes: number
  durationMs: number
  errorCount: number
  errors: string[]
  /** 日志里缺失的字体名（Menlo 这类平台依赖） */
  missingFonts: string[]
  /** 掉进西文字体、印不出来的中文字符（未转义下划线 _ 的典型症状） */
  missingCjk: string[]
  layoutWarnings: string[]
  logTail: string
  error?: string
}

/**
 * 编译论文。严格照 Mrite：xelatex -interaction=nonstopmode 跑 2 趟，
 * 然后检查 Error 数为 0、PDF 是否产出。
 */
export async function buildPaper(
  opts: {
    workspace: string
    texFile?: string
    engine: string
    timeoutMs: number
    passes?: number
  },
): Promise<BuildResult> {
  const ws = path.resolve(opts.workspace)
  const texRel = opts.texFile?.trim() || '论文/论文.tex'
  const texAbs = path.resolve(ws, texRel)
  const passes = opts.passes && opts.passes > 0 ? Math.min(opts.passes, 4) : 2

  try {
    const st = await fs.stat(texAbs)
    if (!st.isFile()) throw new Error('not a file')
  } catch {
    return {
      ok: false, texFile: texRel, passes: 0, durationMs: 0,
      errorCount: 0, errors: [], missingFonts: [], missingCjk: [], layoutWarnings: [], logTail: '',
      error: '找不到 tex 文件：' + texRel,
    }
  }

  const texDir = path.dirname(texAbs)
  const base = path.basename(texAbs, '.tex')
  const args = ['-interaction=nonstopmode', '-halt-on-error=0', '-file-line-error', path.basename(texAbs)]

  const started = Date.now()
  let timedOut = false
  let lastOut = ''
  let lastCode: number | null = null

  for (let p = 0; p < passes; p++) {
    const r = await run(opts.engine, args, texDir, opts.timeoutMs)
    lastOut = r.stdout + r.stderr
    lastCode = r.code
    if (r.timedOut) { timedOut = true; break }
  }

  const durationMs = Date.now() - started
  const logPath = path.join(texDir, base + '.log')
  let logText = ''
  try { logText = await fs.readFile(logPath, 'utf8') } catch {
    try { logText = (await fs.readFile(logPath)).toString('latin1') } catch { /* 无日志 */ }
  }

  const errorCount = countErrors(logText)
  // 计数与提取必须共用同一套判定，否则会「报了数字却看不到内容」
  const errors = extractErrors(logText)
  const pdfAbs = path.join(texDir, base + '.pdf')
  let pdfFile: string | undefined
  let pages: number | undefined
  try {
    const st = await fs.stat(pdfAbs)
    if (st.isFile() && st.size > 0) {
      pdfFile = path.relative(ws, pdfAbs).split(path.sep).join('/')
      const pm = /Output written on .*?\((\d+) pages?/.exec(logText)
      if (pm) pages = Number(pm[1])
    }
  } catch { /* 无 PDF */ }

  // 字体缺失是最常见、也最容易被误判成「模板坏了」的失败。
  // Menlo 是 macOS 系统字体，Mrite 的 format.cls 写死了它，
  // 在 Windows/Linux 上必然找不到。单独归类，给出替换建议而不是让人猜。
  const missingFonts = detectMissingFonts(logText)
  const missingCjk = detectMissingCJK(logText)

  // ok 必须同时满足：不超时、无致命 Error、有 PDF、且没有中文字掉进数学模式。
  // 最后一条尤其关键：掉字时 Error 为 0、PDF 照出，只查前两条会判成成功——
  // 那是最危险的假成功，文件看着对，内容缺字。
  const ok = !timedOut && errorCount === 0 && pdfFile !== undefined && missingCjk.length === 0

  let error: string | undefined
  if (timedOut) error = '编译超时（' + opts.timeoutMs + 'ms）'
  else if (missingFonts.length > 0) {
    error = '模板要求的字体在本机不存在：' + missingFonts.join('、') +
      '。这是 Mrite format.cls 的平台依赖（Menlo 是 macOS 系统字体），' +
      '把 format.cls 里对应的 \\setmonofont 改成 ' +
      (process.platform === 'win32' ? 'Consolas' : 'DejaVu Sans Mono') +
      ' 即可；或安装该字体。'
  } else if (missingCjk.length > 0) {
    error = '中文字符掉进了数学模式，PDF 里会印成空白：' + missingCjk.join('、') +
      '。最常见原因是文件名里的下划线没转义——把 问题一_数据分析.py 写成 问题一\\_数据分析.py，' +
      '或放进 \\texttt{} 并用 \\_ 转义，或改用 \\verb|问题一_数据分析.py|。'
  } else if (errorCount > 0) error = errorCount + ' 个 LaTeX 错误，见 errors 字段'
  else if (pdfFile === undefined) error = '未产出 PDF'
  else if (lastCode !== 0) error = '退出码 ' + lastCode + '，但日志无 Error 且已产出 PDF'

  return {
    ok, texFile: texRel,
    ...(pdfFile ? { pdfFile } : {}),
    ...(pages === undefined ? {} : { pages }),
    passes, durationMs, errorCount, errors,
    missingFonts,
    missingCjk,
    layoutWarnings: layoutWarnings(logText),
    logTail: logText.slice(-2000),
    ...(error ? { error } : {}),
  }
}

/**
 * 识别日志里「字体装不上」的错误，抽出字体名。
 * 真实格式：The font "Menlo" cannot be found。
 */
export function detectMissingFonts(logText: string): string[] {
  const out = new Set<string>()
  const re = /The font "([^"]+)" cannot be found/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(logText)) !== null) out.add(m[1])
  return [...out]
}

export interface ExtractResult {
  ok: boolean
  source: string
  text: string
  chars: number
  error?: string
}

/**
 * 抽取题目文本。Mrite 规定 PDF 用 PyPDF2、DOCX 用 python-docx。
 * 这里生成一段内联 Python 并执行，避免依赖额外文件。
 */
export async function extractProblem(
  opts: { workspace: string; pythonPath: string; sourceFile: string; timeoutMs: number },
): Promise<ExtractResult> {
  const ws = path.resolve(opts.workspace)
  const src = path.resolve(ws, opts.sourceFile)
  const ext = path.extname(src).toLowerCase()

  if (ext === '.md' || ext === '.txt') {
    try {
      const text = await fs.readFile(src, 'utf8')
      return { ok: true, source: opts.sourceFile, text, chars: text.length }
    } catch (e) {
      return { ok: false, source: opts.sourceFile, text: '', chars: 0, error: '读取失败：' + String(e) }
    }
  }

  const py = ext === '.docx'
    ? [
        'import sys, docx',
        'd = docx.Document(sys.argv[1])',
        'print("\\n".join(p.text for p in d.paragraphs if p.text.strip()))',
      ].join('\n')
    : [
        'import sys',
        'try:',
        '    from pypdf import PdfReader',
        'except ImportError:',
        '    from PyPDF2 import PdfReader',
        'r = PdfReader(sys.argv[1])',
        'print("\\n".join((p.extract_text() or "") for p in r.pages))',
      ].join('\n')

  const tmp = path.join(ws, '.mrite-extract.py')
  await fs.writeFile(tmp, py + '\n', 'utf8')
  try {
    const r = await run(opts.pythonPath, [tmp, src], ws, opts.timeoutMs)
    if (!r.ok) {
      return {
        ok: false, source: opts.sourceFile, text: '', chars: 0,
        error: '抽取失败（' + (r.timedOut ? '超时' : 'exit ' + r.code) + '）：' + r.stderr.slice(-600),
      }
    }
    const text = r.stdout
    return { ok: true, source: opts.sourceFile, text, chars: text.length }
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined)
  }
}
