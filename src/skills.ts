import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

/**
 * 把内置的论文规范文档注册为随包 skill。
 *
 * 关键决策：内容不改。
 *   这份 30KB 是完整的数学建模方法层——摘要字数分配、longtable 列宽公式、
 *   9 框流程图模板、各题型建模步骤划分，都在里面。
 *
 * 为什么用 resourceBase 指向文件而不是把全文塞进 content：
 *   skill 目录常驻的只有 name + description（决定路由），全文按需读取。
 *   30KB 常驻会挤占上下文，而绝大多数请求并不需要全文。
 */

export const SKILL_NAME = 'mathmodel'

export const SKILL_DESCRIPTION =
  '数学建模竞赛全流程：读题→求解计划→逐题求解→写论文→编译 PDF。含论文规范（摘要≤900字1页、longtable列宽公式、流程图固定模板、各题型建模步骤）与 Python 绘图规范。Use when the user gives a contest problem (题目/数据 files) and asks to solve it, or when writing/revising a 数学建模 paper, or when deciding 摘要字数分配 / 表格列宽 / 图表规范 / 章节结构.'

/** 读取方法文档全文 */
export async function readMethodDoc(): Promise<string> {
  const p = fileURLToPath(new URL('../skill/METHOD.md', import.meta.url))
  return fs.readFile(p, 'utf8')
}

/**
 * 通过宿主官方 skill seam（ctx.skills）注册。
 * 组合里没有 skills 服务时静默降级——工具侧不受影响。
 */
export function registerSkills(ctx: Context): () => void {
  const skills = (ctx as any).get?.('skills')
  if (skills == null || typeof skills.register !== 'function') return () => {}

  const base = new URL('../skill/', import.meta.url)
  const disposer = skills.register({
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: fileURLToPath(base) },
  })
  return () => { if (typeof disposer === 'function') disposer() }
}

/** 模板目录下的文件清单（供 mr_template 检查完整性） */
export async function listTemplates(): Promise<string[]> {
  const dir = fileURLToPath(new URL('../templates/', import.meta.url))
  const out: string[] = []
  const walk = async (rel: string) => {
    const ents = await fs.readdir(path.join(dir, rel || '.'), { withFileTypes: true })
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) await walk(r)
      else if (e.isFile() && e.name !== 'README.md') out.push(r)
    }
  }
  await walk('')
  return out.sort()
}

/** 读取模板文件内容（相对 templates/ 的路径） */
export async function readTemplate(rel: string): Promise<string> {
  const dir = fileURLToPath(new URL('../templates/', import.meta.url))
  const abs = path.resolve(dir, rel)
  if (!abs.startsWith(path.resolve(dir))) throw new Error('模板路径越界：' + rel)
  return fs.readFile(abs, 'utf8')
}
