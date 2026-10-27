/**
 * 测试期 shim：让 lib/*.js 能在 node 里被 import。
 * 真实运行期 @deepseek-ai/dsh-tools 由 DSH Loader 提供。
 * shim 复刻真实宿主的注册规则（缺 output{schema,render} 就拒绝），
 * 使测试同时成为那道历史事故的回归防线。
 */

export function defineTool(options) {
  if (!options || typeof options !== 'object') throw new Error('defineTool: options required')
  if (!options.name || typeof options.name !== 'string') throw new Error('defineTool: name required')
  if (!options.description || typeof options.description !== 'string') {
    throw new Error('defineTool(' + options.name + '): description required')
  }
  if (!options.output || typeof options.output !== 'object') {
    throw new Error('defineTool(' + options.name + '): must declare output { schema, render }')
  }
  if (!options.output.schema || typeof options.output.schema !== 'object') {
    throw new Error('defineTool(' + options.name + '): output.schema required')
  }
  if (typeof options.output.render !== 'function') {
    throw new Error('defineTool(' + options.name + '): output.render required')
  }
  if (typeof options.execute !== 'function') {
    throw new Error('defineTool(' + options.name + '): execute required')
  }
  return options
}

export default { defineTool }
