import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Config } from './config.js'
import {
  initWorkspace, inspectWorkspace, resolveWorkspace,
  DIRS,
} from './workspace.js'
import { extractProblem, buildPaper, run } from './exec.js'
import { readMethodDoc, listTemplates, readTemplate } from './skills.js'

const NL = String.fromCharCode(10)

/**
 * mr_init：建工作区。
 * 对应规范「新题使用」第 1-3 步：复制模板 → 题目放 题目/ → 数据放 数据/。
 */
export function registerInitTool(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'mr_init',
    description:
      'Create a math-modeling working directory: 题目/ (problem statement), 数据/ (attachment data), 求解/ (generated), 论文/ (LaTeX template with format.cls + 17 chapter files + fonts). Idempotent — existing files are never overwritten. Use this first, before putting the contest files in place.',
    parameters: {
      dir: { type: 'string', description: 'Workspace root. Defaults to config.workspaceRoot, else the current working directory.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          workspace: { type: 'string', required: true },
          created: { type: 'array', required: true, items: { type: 'string' } },
          skipped: { type: 'array', required: true, items: { type: 'string' } },
          templateFiles: { type: 'number', required: true },
          nextSteps: { type: 'array', required: true, items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        if (!v.ok) return [{ type: 'text', text: '✗ 建工作区失败：' + (v.error ?? '未知原因') }]
        const lines = [
          '✓ 数学建模工作区就绪 → ' + v.workspace,
          '新建：' + (v.created.length ? v.created.join('、') : '无'),
          '跳过（已存在）：' + (v.skipped.length ? v.skipped.length + ' 项' : '无'),
          '论文模板：' + v.templateFiles + ' 个文件已铺好',
          '',
          '下一步：',
          ...v.nextSteps.map((s: string) => '  · ' + s),
        ]
        return [{ type: 'text', text: lines.join(NL) }]
      },
    },
    async execute(args) {
      const ws = resolveWorkspace(config, args.dir)
      try {
        const r = await initWorkspace(config, { dir: ws })
        return {
          ok: true,
          workspace: r.workspace,
          created: r.created,
          skipped: r.skipped,
          templateFiles: r.templateFiles,
          nextSteps: [
            '把赛题 PDF/DOCX 放进 ' + DIRS.problem + '/',
            '把附件数据 xlsx/docx/csv 放进 ' + DIRS.data + '/',
            '然后说「开始求解」，或调 mr_status 看现状',
          ],
        }
      } catch (e) {
        return { ok: false, workspace: ws, created: [], skipped: [], templateFiles: 0, nextSteps: [], error: String(e) }
      }
    },
  }))
}

/**
 * mr_status：看工作区现状，对应 CLAUDE.md Step 0 的「打印数据总览」。
 */
export function registerStatusTool(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'mr_status',
    description:
      'Inspect the math-modeling workspace: which problem files sit in 题目/, which data files sit in 数据/, whether 求解计划.md exists, how many 问题X/ directories were produced, and whether the paper has been compiled to PDF. Use when the user asks where the run stands, or before deciding the next step.',
    parameters: {
      dir: { type: 'string', description: 'Workspace root. Defaults to config.workspaceRoot, else the current working directory.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          workspace: { type: 'string', required: true },
          problems: { type: 'array', required: true, items: { type: 'string' } },
          dataFiles: { type: 'array', required: true, items: { type: 'string' } },
          hasPlan: { type: 'boolean', required: true },
          questionDirs: { type: 'array', required: true, items: { type: 'string' } },
          paperFiles: { type: 'number', required: true },
          hasPdf: { type: 'boolean', required: true },
          mainTexExists: { type: 'boolean', required: true },
        },
      },
      render: (_args, v) => {
        const mark = (b: boolean) => (b ? '✓' : '✗')
        const lines = [
          '数学建模工作区：' + v.workspace,
          mark(v.problems.length > 0) + ' 题目 ' + v.problems.length + ' 个' +
            (v.problems.length ? '：' + v.problems.join('、') : '（需放入 PDF/DOCX）'),
          mark(v.dataFiles.length > 0) + ' 数据 ' + v.dataFiles.length + ' 个' +
            (v.dataFiles.length ? '：' + v.dataFiles.join('、') : '（需放入附件）'),
          mark(v.hasPlan) + ' 求解计划.md',
          mark(v.questionDirs.length > 0) + ' 求解目录 ' + v.questionDirs.length + ' 个' +
            (v.questionDirs.length ? '：' + v.questionDirs.join('、') : ''),
          mark(v.mainTexExists) + ' 论文.tex · ' + v.paperFiles + ' 个文件',
          mark(v.hasPdf) + ' 编译产物 PDF',
        ]
        return [{ type: 'text', text: lines.join(NL) }]
      },
    },
    async execute(args) {
      const ws = resolveWorkspace(config, args.dir)
      try {
        const s = await inspectWorkspace(ws)
        return {
          ok: true,
          workspace: s.workspace,
          problems: s.problems,
          dataFiles: s.dataFiles,
          hasPlan: s.hasPlan,
          questionDirs: s.questionDirs,
          paperFiles: s.paperFiles.length,
          hasPdf: s.hasPdf,
          mainTexExists: s.mainTexExists,
        }
      } catch (e) {
        return {
          ok: false, workspace: ws, problems: [], dataFiles: [], hasPlan: false,
          questionDirs: [], paperFiles: 0, hasPdf: false, mainTexExists: false,
        }
      }
    },
  }))
}

/**
 * mr_problem：抽题目原文。对应 CLAUDE.md Step 0「读 题目/（PDF用PyPDF2，DOCX用python-docx）」。
 */
export function registerProblemTool(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'mr_problem',
    description:
      'Extract the full text of the contest problem statement from 题目/. PDF uses PyPDF2/pypdf, DOCX uses python-docx, MD/TXT read directly. Omit file to auto-pick the single problem file in 题目/. Use at the very start, before writing 求解计划.md — the plan must be based on the real problem text, never on assumptions.',
    parameters: {
      dir: { type: 'string', description: 'Workspace root. Defaults to config.workspaceRoot, else the current working directory.' },
      file: { type: 'string', description: 'Problem file relative to the workspace, e.g. "题目/题目B.pdf". Omit to auto-detect.' },
    },
    timeoutMs: 120_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          source: { type: 'string', required: true },
          chars: { type: 'number', required: true },
          text: { type: 'string', required: true },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        if (!v.ok) return [{ type: 'text', text: '✗ 抽取题目失败：' + (v.error ?? '未知原因') }]
        const body = v.text.length > 1500 ? v.text.slice(0, 1500) + NL + '…（全文 ' + v.chars + ' 字，已截断显示）' : v.text
        return [{ type: 'text', text: '✓ 题目：' + v.source + '（' + v.chars + ' 字）' + NL + NL + body }]
      },
    },
    async execute(args) {
      const ws = resolveWorkspace(config, args.dir)
      try {
        let file = args.file?.trim()
        if (!file) {
          const files = (await fs.readdir(path.join(ws, DIRS.problem)).catch(() => [] as string[]))
            .filter((f) => /\.(pdf|docx|md|txt)$/i.test(f))
          if (files.length === 0) {
            return { ok: false, source: '', chars: 0, text: '', error: '题目/ 下没有 PDF/DOCX/MD/TXT 文件，请先放入赛题' }
          }
          if (files.length > 1) {
            return { ok: false, source: '', chars: 0, text: '', error: '题目/ 下有多个文件，请用 file 参数指定：' + files.join('、') }
          }
          file = DIRS.problem + '/' + files[0]
        }
        const r = await extractProblem({
          workspace: ws,
          pythonPath: config.pythonPath,
          sourceFile: file,
          timeoutMs: 100_000,
        })
        return {
          ok: r.ok, source: r.source, chars: r.chars, text: r.text,
          ...(r.error ? { error: r.error } : {}),
        }
      } catch (e) {
        return { ok: false, source: '', chars: 0, text: '', error: String(e) }
      }
    },
  }))
}

/**
 * mr_run：跑一个求解脚本。对应 CLAUDE.md Step 2「每问一个 py 文件」。
 */
export function registerRunTool(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'mr_run',
    description:
      'Run one solve script (usually 求解/问题一/问题一_xxx.py) under the workspace, streaming back exit code, stdout/stderr and the files it created. The workflow expects one Python file per question and a compute-then-plot order, so run them one at a time and read the printed statistics before writing the paper. Use after the script is written, and fix and re-run until it exits 0.',
    parameters: {
      dir: { type: 'string', description: 'Workspace root. Defaults to config.workspaceRoot, else the current working directory.' },
      script: { type: 'string', description: 'Python script path relative to the workspace, e.g. "求解/问题一/问题一_预测.py".' },
      timeoutMs: { type: 'number', description: 'Timeout in milliseconds. Defaults to config.runTimeoutMs (600000).' },
    },
    timeoutMs: 900_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          script: { type: 'string', required: true },
          code: { type: 'number' },
          durationMs: { type: 'number', required: true },
          stdoutTail: { type: 'string', required: true },
          stderrTail: { type: 'string', required: true },
          createdFiles: { type: 'array', required: true, items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        const head = v.ok
          ? '✓ 运行成功：' + v.script + '（' + v.durationMs + 'ms）'
          : '✗ 运行失败：' + v.script + (v.code === undefined ? '' : '（exit ' + v.code + '）')
        const lines = [head]
        if (v.createdFiles.length) lines.push('产出 ' + v.createdFiles.length + ' 个文件：' + v.createdFiles.slice(0, 12).join('、'))
        if (v.stdoutTail) {
          lines.push('', 'stdout（供论文引用）：')
          lines.push(v.stdoutTail.split(NL).slice(-25).join(NL))
        }
        if (v.stderrTail) {
          lines.push('', 'stderr：')
          lines.push(v.stderrTail.split(NL).slice(-15).join(NL))
        }
        if (v.error) lines.push('', '说明：' + v.error)
        return [{ type: 'text', text: lines.join(NL) }]
      },
    },
    async execute(args) {
      const ws = resolveWorkspace(config, args.dir)
      const script = args.script?.trim()
      if (!script) {
        return { ok: false, script: '', durationMs: 0, stdoutTail: '', stderrTail: '', createdFiles: [], error: '需要 script 参数' }
      }
      const abs = path.resolve(ws, script)
      if (!abs.startsWith(path.resolve(ws))) {
        return { ok: false, script, durationMs: 0, stdoutTail: '', stderrTail: '', createdFiles: [], error: '脚本必须位于工作区内' }
      }
      try {
        const st = await fs.stat(abs)
        if (!st.isFile()) throw new Error('not a file')
      } catch {
        return { ok: false, script, durationMs: 0, stdoutTail: '', stderrTail: '', createdFiles: [], error: '找不到脚本：' + script }
      }

      const before = await snapshotFiles(ws)
      const r = await run(config.pythonPath, [abs], path.dirname(abs), args.timeoutMs ?? config.runTimeoutMs)
      const after = await snapshotFiles(ws)
      const createdFiles = [...after].filter((f) => !before.has(f)).sort()

      return {
        ok: r.ok,
        script,
        ...(r.code === null ? {} : { code: r.code }),
        durationMs: r.durationMs,
        stdoutTail: r.stdout.slice(-4000),
        stderrTail: r.stderr.slice(-3000),
        createdFiles,
        ...(r.timedOut ? { error: '运行超时' } : {}),
      }
    },
  }))
}

/** 记录工作区里所有文件（相对路径），用于识别脚本产出了什么 */
async function snapshotFiles(root: string): Promise<Set<string>> {
  const out = new Set<string>()
  const walk = async (abs: string) => {
    let ents: any[]
    try { ents = await fs.readdir(abs, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const p = path.join(abs, e.name)
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules') continue
        await walk(p)
      } else if (e.isFile()) {
        out.add(path.relative(root, p).split(path.sep).join('/'))
      }
    }
  }
  await walk(root)
  return out
}

/**
 * mr_build：编译论文。对应 CLAUDE.md Step 4：
 * xelatex -interaction=nonstopmode 论文.tex，跑两趟，grep -c Error 必须为 0。
 */
export function registerBuildTool(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'mr_build',
    description:
      'Compile the paper per the built-in compile rule: xelatex -interaction=nonstopmode 论文.tex, two passes, then count Error lines in 论文.log which must be 0. Returns errorCount, the Error lines, Overfull/Underfull layout warnings, page count and the PDF path. Use after writing the tex files, and re-run after every fix until errorCount is 0.',
    parameters: {
      dir: { type: 'string', description: 'Workspace root. Defaults to config.workspaceRoot, else the current working directory.' },
      texFile: { type: 'string', description: 'Main TeX file relative to the workspace. Defaults to 论文/论文.tex.' },
      passes: { type: 'number', description: 'Compile passes. Defaults to 2.' },
      timeoutMs: { type: 'number', description: 'Per-pass timeout in milliseconds. Defaults to config.buildTimeoutMs.' },
    },
    timeoutMs: 960_000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          texFile: { type: 'string', required: true },
          pdfFile: { type: 'string' },
          pages: { type: 'number' },
          passes: { type: 'number', required: true },
          durationMs: { type: 'number', required: true },
          errorCount: { type: 'number', required: true },
          errors: { type: 'array', required: true, items: { type: 'string' } },
          /** 字体缺失（不计入 errorCount，单列出来让人知道是环境问题） */
          missingFonts: { type: 'array', required: true, items: { type: 'string' } },
          /** 掉进数学模式、印成空白的中文字（多为未转义下划线 _） */
          missingCjk: { type: 'array', required: true, items: { type: 'string' } },
          layoutWarnings: { type: 'array', required: true, items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        const head = v.ok
          ? '✓ 编译成功：' + (v.pdfFile ?? '') + (v.pages ? '（' + v.pages + ' 页）' : '')
          : '✗ 编译失败（' + v.errorCount + ' 个 Error）'
        const lines = [head, '论文 ' + v.texFile + ' · ' + v.passes + ' 趟 · ' + v.durationMs + 'ms']
        if (v.errors.length) {
          lines.push('', 'Error：')
          for (const e of v.errors.slice(0, 12)) lines.push('  · ' + e)
        }
        if (v.missingFonts.length) {
          lines.push('', '⚠ 字体缺失（不计入 Error）：' + v.missingFonts.join('、') +
            ' — 属本机字体环境，format.cls 已做逐级回退；装了该字体即可恢复原字形')
        }
        if (v.missingCjk.length) {
          lines.push('', '⚠ 中文掉字（印成空白）：' + v.missingCjk.join('、') +
            ' — 多半是文件名里的下划线没转义，改成 \\_ 或包进 \\verb|| 即可')
        }
        if (v.layoutWarnings.length) {
          lines.push('', '排版警告 ' + v.layoutWarnings.length + ' 条（Step 5 优化目标）：')
          for (const w of v.layoutWarnings.slice(0, 6)) lines.push('  · ' + w)
        }
        if (v.error) lines.push('', '说明：' + v.error)
        return [{ type: 'text', text: lines.join(NL) }]
      },
    },
    async execute(args) {
      const ws = resolveWorkspace(config, args.dir)
      const r = await buildPaper({
        workspace: ws,
        texFile: args.texFile,
        engine: config.latexEngine,
        timeoutMs: args.timeoutMs ?? config.buildTimeoutMs,
        passes: args.passes,
      })
      return {
        ok: r.ok,
        texFile: r.texFile,
        ...(r.pdfFile ? { pdfFile: r.pdfFile } : {}),
        ...(r.pages === undefined ? {} : { pages: r.pages }),
        passes: r.passes,
        durationMs: r.durationMs,
        errorCount: r.errorCount,
        errors: r.errors,
        missingFonts: r.missingFonts,
        missingCjk: r.missingCjk,
        layoutWarnings: r.layoutWarnings,
        ...(r.error ? { error: r.error } : {}),
      }
    },
  }))
}

/**
 * mr_method：取内置的方法规范原文。
 * 这是「原样封装」的体现——规范不经过任何改写。
 */
export function registerMethodTool(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'mr_method',
    description:
      'Return the built-in method specification — covering the full pipeline (Step 0 read input → Step 1 求解计划.md → Step 2 per-question solve → Step 3 paper chapters → Step 4 compile), the paper rules (摘要≤900 chars and exactly 1 page, longtable column-width formula, the fixed 9-box flowchart template, per-model-type modeling steps), and the Python rules (matplotlib only, compute-then-plot, cross-platform Chinese fonts). Read this before writing the plan, any solve script, or any paper section.',
    parameters: {
      full: { type: 'boolean', description: 'Return the full text. Defaults to true; set false to get only the section index.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          chars: { type: 'number', required: true },
          sections: { type: 'array', required: true, items: { type: 'string' } },
          text: { type: 'string', required: true },
        },
      },
      render: (_args, v) => [{
        type: 'text',
        text: v.text.length > 3000
          ? v.text.slice(0, 3000) + NL + '…（方法规范全文 ' + v.chars + ' 字，此处截断；已完整注入上下文）'
          : v.text,
      }],
    },
    async execute(args) {
      const text = await readMethodDoc()
      const sections = text.split(/\r?\n/).filter((l: string) => /^#{1,3}\s/.test(l)).map((l: string) => l.trim())
      const full = args.full !== false
      return {
        ok: true,
        chars: text.length,
        sections,
        text: full ? text : ['论文规范章节：', ...sections].join(NL),
      }
    },
  }))
}

/**
 * mr_template：查看/读取论文模板。对应「复制 模板/ 到工作目录」。
 */
export function registerTemplateTool(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'mr_template',
    description:
      'List the bundled paper template files (format.cls, fonts, and the 17 chapter tex files), or read one file verbatim. Use when copying a chapter template to create 5.X.1.分析与准备.tex / 5.X.2.建模与求解.tex for a new question, or when checking what the template expects.',
    parameters: {
      file: { type: 'string', description: 'Template file relative to templates/, e.g. "5.1.1.分析与准备.tex". Omit to list all files.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          files: { type: 'array', required: true, items: { type: 'string' } },
          file: { type: 'string' },
          content: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        if (!v.ok) return [{ type: 'text', text: '✗ ' + (v.error ?? '读取模板失败') }]
        if (v.file && v.content !== undefined) {
          const body = v.content.length > 4000 ? v.content.slice(0, 4000) + NL + '…（已截断）' : v.content
          return [{ type: 'text', text: '模板 ' + v.file + '：' + NL + NL + body }]
        }
        return [{ type: 'text', text: '论文模板 ' + v.files.length + ' 个文件：' + NL + v.files.map((f: string) => '  · ' + f).join(NL) }]
      },
    },
    async execute(args) {
      const file = args.file?.trim()
      if (!file) {
        return { ok: true, files: await listTemplates() }
      }
      try {
        const content = await readTemplate(file)
        return { ok: true, files: [], file, content }
      } catch (e) {
        return { ok: false, files: [], error: String(e) }
      }
    },
  }))
}
