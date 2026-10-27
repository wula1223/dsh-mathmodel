/**
 * 工具定义的本地构造器 —— 替代 `import { defineTool } from '@deepseek-ai/dsh-tools'`。
 *
 * 为什么不 import 那个包：
 *   实测 `@deepseek-ai/dsh-tools` 在用户 profile 的 node_modules 里【不存在】，
 *   它由 DSH Loader 在运行时内部提供。插件一旦 import 它，
 *   装到别人机器上会直接抛 "Cannot find package"，插件加载失败、整个插件不可用。
 *   对比已正常工作的第三方插件（dsh-git-forge / dsh-better-sidebar），
 *   它们都不 import 任何 `@deepseek-ai/*`，只通过注入的 ctx.tools 注册。
 *
 * 宿主真正校验的东西（从宿主源码 L792210 确认）：
 *   output 必须声明 { schema, render, presentationMeta? }
 *   所以在本地把这条校验复刻出来，构造出的定义与 defineTool 等价。
 */
export interface ToolRenderNode {
    type: string;
    text: string;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render(args: any, value: any): ToolRenderNode[];
        presentationMeta?(args: any, value: any): unknown;
    };
    timeoutMs?: number;
    deferLoading?: boolean;
    isConcurrencySafe?: boolean;
    execute(args: any, exec?: any): Promise<any>;
}
/**
 * 与宿主同规则的构造器：缺 name / description / output{schema,render} / execute 都直接抛错，
 * 让错误在开发期暴露，而不是等用户装完才在加载时炸。
 */
export declare function defineTool(options: ToolDefinition): ToolDefinition;
