import type { Context } from '@deepseek-ai/cordis'
import { Config, type Config as MriteConfig } from './config.js'
import { registerSkills } from './skills.js'
import {
  registerInitTool, registerStatusTool, registerProblemTool,
  registerRunTool, registerBuildTool, registerMethodTool, registerTemplateTool,
} from './tools.js'

export const name = 'dsh-mathmodel'

/** 依赖的宿主服务：tools 必选。 */
export const inject = ['tools']

export { Config }

/**
 * Mrite 插件入口。
 *
 * 封装原则（第一阶段：只封装，不改进）：
 *   1. 方法层 —— Mrite 的 CLAUDE.md 原样注册为 skill，内容不改一字
 *   2. 资产层 —— 17 个 tex 模板 + format.cls + 思源宋体，原样随包
 *   3. 能力层 —— 新增工具只做「把 Mrite 规程里手写的命令变成调用」，
 *      不新增 Mrite 没有的流程环节
 */
export function apply(ctx: Context, config: MriteConfig) {
  registerInitTool(ctx, config)
  registerStatusTool(ctx, config)
  registerProblemTool(ctx, config)
  registerRunTool(ctx, config)
  registerBuildTool(ctx, config)
  registerMethodTool(ctx)
  registerTemplateTool(ctx)
  registerSkills(ctx)
}
