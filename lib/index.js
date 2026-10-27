import { Config } from './config.js';
import { registerSkills } from './skills.js';
import { registerInitTool, registerStatusTool, registerProblemTool, registerRunTool, registerBuildTool, registerMethodTool, registerTemplateTool, } from './tools.js';
export const name = 'dsh-mathmodel';
/** 依赖的宿主服务：tools 必选。 */
export const inject = ['tools'];
export { Config };
/**
 * 插件入口。
 *
 * 封装原则（第一阶段：只封装，不改进）：
 *   1. 方法层 —— 内置规范文档注册为 skill
 *   2. 资产层 —— 17 个 tex 模板 + format.cls + 思源宋体，原样随包
 *   3. 能力层 —— 工具只做「把规范里手写的命令变成调用」，
 *      不新增规范之外的流程环节
 */
export function apply(ctx, config) {
    registerInitTool(ctx, config);
    registerStatusTool(ctx, config);
    registerProblemTool(ctx, config);
    registerRunTool(ctx, config);
    registerBuildTool(ctx, config);
    registerMethodTool(ctx);
    registerTemplateTool(ctx);
    registerSkills(ctx);
}
