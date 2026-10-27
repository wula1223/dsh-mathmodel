/**
 * 工作区 —— 目录结构遵循内置规范的「项目结构」一节。
 *
 * 为什么目录名用中文：
 *   规范要求「代码、图、CSV、tex 文件一律中文命名」，目录也是中文。
 *   改成英文会破坏与模板的兼容（模板里 \input{5.1.问题1的建立求解.tex} 是中文名），
 *   所以插件不做任何本地化改造，原样保留。
 *
 * 目录：
 *   题目/     赛题文件（PDF/DOCX）
 *   数据/     附件数据（xlsx/docx/csv）
 *   求解/     AI 自动生成：求解计划.md、问题一/…、问题N/
 *   论文/     AI 自动生成：论文.tex + 17 个章节 tex + format.cls + fonts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from './config.js'

export const DIRS = {
  problem: '题目',
  data: '数据',
  solve: '求解',
  paper: '论文',
} as const

export const PLAN_FILE = '求解/求解计划.md'
export const MAIN_TEX = '论文/论文.tex'

/** 定位本包内随附的模板目录（lib/ 与 templates/ 同级） */
export function templateDir(): string {
  return fileURLToPath(new URL('../templates/', import.meta.url))
}

/** 定位本包内随附的方法文档 */
export function methodDocPath(): string {
  return fileURLToPath(new URL('../skill/METHOD.md', import.meta.url))
}

/** 解析工作区根：优先 config.workspaceRoot，其次传入的 base，最后当前目录 */
export function resolveWorkspace(config: Config, base?: string): string {
  const root = config.workspaceRoot?.trim()
  if (root) return path.resolve(root)
  if (base && base.trim()) return path.resolve(base)
  return process.cwd()
}

/** 递归复制目录 */
export async function copyDir(src: string, dst: string): Promise<number> {
  let n = 0
  await fs.mkdir(dst, { recursive: true })
  const ents = await fs.readdir(src, { withFileTypes: true })
  for (const e of ents) {
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (e.isDirectory()) n += await copyDir(s, d)
    else if (e.isFile()) {
      await fs.copyFile(s, d)
      n++
    }
  }
  return n
}

/** 判断路径是否存在 */
export async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

/** 列出目录下的文件（不存在则空数组） */
export async function listFiles(dir: string): Promise<string[]> {
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true })
    return ents.filter((e) => e.isFile()).map((e) => e.name).sort()
  } catch {
    return []
  }
}

/** 列出子目录名（不存在则空数组） */
export async function listDirs(dir: string): Promise<string[]> {
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true })
    return ents.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  } catch {
    return []
  }
}

export interface InitResult {
  workspace: string
  created: string[]
  skipped: string[]
  templateFiles: number
}

/**
 * 建 数学建模工作区：题目/、数据/、求解/、论文/（含完整模板）。
 * 幂等：已存在的目录不覆盖；论文模板文件已存在则跳过，不冲掉用户内容。
 */
export async function initWorkspace(
  config: Config,
  opts: { dir?: string; force?: boolean } = {},
): Promise<InitResult> {
  const ws = resolveWorkspace(config, opts.dir)
  const created: string[] = []
  const skipped: string[] = []

  await fs.mkdir(ws, { recursive: true })

  for (const d of [DIRS.problem, DIRS.data, DIRS.solve, DIRS.paper]) {
    const p = path.join(ws, d)
    if (await exists(p)) {
      skipped.push(d + '/')
    } else {
      await fs.mkdir(p, { recursive: true })
      created.push(d + '/')
    }
  }

  // 论文目录铺模板（format.cls + 17 个 tex + fonts）
  const tpl = templateDir()
  const paperDir = path.join(ws, DIRS.paper)
  const tplFiles: string[] = []
  const walk = async (rel: string) => {
    const abs = path.join(tpl, rel)
    const ents = await fs.readdir(abs, { withFileTypes: true })
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) await walk(r)
      else if (e.isFile()) tplFiles.push(r)
    }
  }
  await walk('')

  let templateFiles = 0
  for (const rel of tplFiles) {
    if (rel === 'README.md') continue // 模板自述不进工作区
    const dst = path.join(paperDir, rel)
    if (await exists(dst)) {
      skipped.push(DIRS.paper + '/' + rel)
      continue
    }
    await fs.mkdir(path.dirname(dst), { recursive: true })
    await fs.copyFile(path.join(tpl, rel), dst)
    templateFiles++
  }
  created.push(DIRS.paper + '/ （模板 ' + templateFiles + ' 个文件）')

  return { workspace: ws, created, skipped, templateFiles }
}

export interface WorkspaceStatus {
  workspace: string
  problems: string[]
  dataFiles: string[]
  hasPlan: boolean
  questionDirs: string[]
  paperFiles: string[]
  hasPdf: boolean
  mainTexExists: boolean
}

/** 扫工作区现状 */
export async function inspectWorkspace(ws: string): Promise<WorkspaceStatus> {
  const problems = await listFiles(path.join(ws, DIRS.problem))
  const dataFiles = await listFiles(path.join(ws, DIRS.data))
  const hasPlan = await exists(path.join(ws, PLAN_FILE))
  const questionDirs = await listDirs(path.join(ws, DIRS.solve)).then((ds) => ds.filter((d) => d.startsWith('问题')))
  const paperFiles = await listFiles(path.join(ws, DIRS.paper))
  const hasPdf = paperFiles.some((f) => f.toLowerCase().endsWith('.pdf'))
  const mainTexExists = await exists(path.join(ws, MAIN_TEX))
  return { workspace: ws, problems, dataFiles, hasPlan, questionDirs, paperFiles, hasPdf, mainTexExists }
}
