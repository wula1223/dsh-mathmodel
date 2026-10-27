/**
 * 本地类型声明 —— 不依赖 `@deepseek-ai/cordis` 的类型包。
 *
 * 为什么不用 import type { Context } from '@deepseek-ai/cordis'：
 *   那个包在用户 profile 里不存在（Loader 内部提供）。
 *   虽然 `import type` 编译后会被擦除、运行期无影响，
 *   但为了彻底断开对宿主私有包的依赖，这里只声明本插件实际用到的两个成员。
 */
export interface CordisContext {
    /** 取宿主服务（如 skills） */
    get?(name: string): any;
    /** 注册可随 fiber 释放的副作用 */
    effect?(fn: () => void | (() => void), label?: string): void;
    /** dsh-tools 注册的服务 */
    tools: {
        register(definition: any): any;
    };
}
export type Context = CordisContext;
