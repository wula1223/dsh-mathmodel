import { pathToFileURL } from 'node:url'
import path from 'node:path'

const SHIM = pathToFileURL(path.join(import.meta.dirname, 'shim-dshtools.mjs')).href

export async function resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/dsh-tools') {
    return { url: SHIM, shortCircuit: true }
  }
  return next(specifier, context)
}
