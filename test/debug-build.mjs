import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { registerInitTool, registerBuildTool } from '../lib/tools.js'

const NL = String.fromCharCode(10)
const config = { pythonPath: 'python', latexEngine: 'xelatex', buildTimeoutMs: 300000, runTimeoutMs: 600000 }

const init = new Map()
registerInitTool({ tools: { register: (d) => init.set(d.name, d) } }, config)
const build = new Map()
registerBuildTool({ tools: { register: (d) => build.set(d.name, d) } }, config)

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mrite-dbg-'))
const ws = path.join(tmp, 'ws')

await init.get('mr_init').execute({ dir: ws })
const r = await build.get('mr_build').execute({ dir: ws })

console.log('ok=' + r.ok + ' errorCount=' + r.errorCount + ' pages=' + r.pages)
console.log('--- 错误全文 ---')
for (const e of r.errors ?? []) console.log('  ' + e)

// 读日志，找上下文
const log = await fs.readFile(path.join(ws, '论文', '论文.log'), 'utf8')
const lines = log.split(/\r?\n/)
console.log('--- 日志中 Error 行及前后文 ---')
for (let i = 0; i < lines.length; i++) {
  if (/^!|LaTeX Error/.test(lines[i])) {
    console.log('  [' + (i + 1) + '] ' + lines[i])
    for (let j = 1; j <= 4 && i + j < lines.length; j++) {
      if (lines[i + j].trim()) console.log('        ↳ ' + lines[i + j].trim().slice(0, 160))
    }
  }
}

console.log('--- 工作区保留 ---')
console.log(ws)
