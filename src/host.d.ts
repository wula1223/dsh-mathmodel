/**
 * 最小 ambient 声明：只为 tsc 提供 `@deepseek-ai/schemastery` 的类型。
 *
 * 为什么只声明这一个：
 *   实测用户 profile 的 node_modules 里，`@deepseek-ai/schemastery` 【存在】，
 *   而 `@deepseek-ai/dsh-tools` 和 `@deepseek-ai/cordis` 【不存在】。
 *   后两者由 DSH Loader 运行时内部提供，插件若 import 它们，
 *   别人装完会直接抛 "Cannot find package"，整个插件加载失败。
 *   所以本插件只在运行期真正需要的地方保留 schemastery，
 *   工具构造与 Context 类型都改用本地的 `define-tool.ts` / `types.ts`。
 */
declare module '@deepseek-ai/schemastery' {
  interface Schema<T> {
    default(value: T): Schema<T>
    description(text: string): Schema<T>
  }
  interface SchemaStatic {
    object<T extends object>(shape: Record<string, any>): Schema<T>
    string(): Schema<string>
    number(): Schema<number>
    boolean(): Schema<boolean>
    union<T>(values: readonly T[]): Schema<T>
  }
  const Schema: SchemaStatic
  export default Schema
}
