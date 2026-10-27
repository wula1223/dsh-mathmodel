/**
 * 宿主 @deepseek-ai/* 包在桌面端 asar 内不携带可被 tsc 解析的 .d.ts，
 * 这里给出最小 ambient 声明，使本插件可以编译。
 * 运行期由 DSH 的 Loader 提供真实实现。
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    get(name: string): any
    effect(fn: () => void | (() => void), label?: string): void
    /** dsh-tools 注册的服务 */
    tools: {
      register(definition: any): () => void
    }
  }
}

declare module '@deepseek-ai/dsh-tools' {
  export interface ToolOutputSpec {
    schema: any
    render(args: any, value: any): { type: string; text: string }[]
    presentationMeta?(args: any, value: any): any
  }
  export interface ToolOptions {
    name: string
    description: string
    parameters?: Record<string, any>
    output: ToolOutputSpec
    timeoutMs?: number
    deferLoading?: boolean
    isConcurrencySafe?: boolean
    presentCall?(args: any): any
    presentResult?(args: any, value: any): any
    execute(args: any, exec: any): Promise<any>
  }
  export function defineTool(options: ToolOptions): any
}

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