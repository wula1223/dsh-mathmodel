import type { Context } from './types.js';
import { Config, type Config as MathModelConfig } from './config.js';
export declare const name = "dsh-mathmodel";
/** 依赖的宿主服务：tools 必选。 */
export declare const inject: string[];
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
export declare function apply(ctx: Context, config: MathModelConfig): void;
