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
function isPlainRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * 与宿主同规则的构造器：缺 name / description / output{schema,render} / execute 都直接抛错，
 * 让错误在开发期暴露，而不是等用户装完才在加载时炸。
 */
export function defineTool(options) {
    if (!isPlainRecord(options))
        throw new Error('defineTool: options must be an object');
    if (!options.name || typeof options.name !== 'string')
        throw new Error('defineTool: name is required');
    if (!options.description || typeof options.description !== 'string') {
        throw new Error('defineTool(' + options.name + '): description is required');
    }
    if (!isPlainRecord(options.output)) {
        throw new Error('defineTool(' + options.name + ') output must declare { schema, render, presentationMeta? }');
    }
    if (!isPlainRecord(options.output.schema)) {
        throw new Error('defineTool(' + options.name + '): output.schema is required');
    }
    if (typeof options.output.render !== 'function') {
        throw new Error('defineTool(' + options.name + '): output.render is required');
    }
    if (typeof options.execute !== 'function') {
        throw new Error('defineTool(' + options.name + '): execute is required');
    }
    return options;
}
