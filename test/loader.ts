import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {transformSync} from 'esbuild'

const {getFormat, transformSource} = createLoader()

export {getFormat, transformSource}

/**
 * A tiny JSX loader.
 */
export function createLoader() {
  return {getFormat, transformSource}

  function getFormat(url: string, context: unknown, defaultGetFormat: Function) {
    return path.extname(url) === '.jsx'
      ? {format: 'module'}
      : defaultGetFormat(url, context, defaultGetFormat)
  }

  async function transformSource(value: Buffer, context: {url: string, [x: string]: unknown}, defaultTransformSource: Function) {
    if (path.extname(context.url) !== '.jsx') {
      return defaultTransformSource(value, context, defaultTransformSource)
    }

    const {code, warnings} = transformSync(String(value), {
      sourcefile: fileURLToPath(context.url),
      sourcemap: 'both',
      loader: 'jsx',
      target: 'esnext',
      format: context.format === 'module' ? 'esm' : 'cjs'
    })

    if (warnings && warnings.length > 0) {
      for (const warning of warnings) {
        console.log(warning.location)
        console.log(warning.text)
      }
    }

    return {source: code}
  }
}
