/**
 * 插件配置。
 *
 * 关键决定：不 import `@deepseek-ai/schemastery`。
 *
 * 为什么：官方文档（develop/basic/publish）说明，组合包安装到用户 profile 后，
 * 依赖来自【用户 profile 的 node_modules】，而不是 DSH 源码仓库。
 * 虽然实测某些 profile 恰好装了 schemastery，但这是偶然、不能依赖——
 * 换一台机器或换个 profile 就可能缺失，导致插件加载失败。
 *
 * 替代方案：Cordis 的配置就是一个「字段名 → 默认值」的普通对象。
 * 插件实际只需要几个默认值，不需要 schema 校验，用纯对象等价且零依赖。
 */

export interface Config {
  /** 工作区根目录；留空则用会话工作目录 */
  workspaceRoot?: string
  /** Python 解释器 */
  pythonPath: string
  /** LaTeX 编译器 */
  latexEngine: 'xelatex' | 'tectonic'
  /** 每趟编译超时（毫秒） */
  buildTimeoutMs: number
  /** 求解脚本默认超时（毫秒） */
  runTimeoutMs: number
}

/** 默认值 */
export const DEFAULT_CONFIG: Config = {
  pythonPath: 'python',
  latexEngine: 'xelatex',
  buildTimeoutMs: 300000,
  runTimeoutMs: 600000,
}

/**
 * 配置定义：键名即字段名，值为默认值。
 * 用户传入的配置会覆盖这些默认值。
 */
export const Config = {
  workspaceRoot: '',
  pythonPath: DEFAULT_CONFIG.pythonPath,
  latexEngine: DEFAULT_CONFIG.latexEngine,
  buildTimeoutMs: DEFAULT_CONFIG.buildTimeoutMs,
  runTimeoutMs: DEFAULT_CONFIG.runTimeoutMs,
}

/** 把用户传入的部分配置补全为完整 Config */
export function resolveConfig(partial?: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...(partial ?? {}) }
}
