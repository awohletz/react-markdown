import {ReactNode, ReactElement} from "react";
import {PluggableList} from "unified";
import {Root} from "hast";
import {Options as FilterOptions} from "./rehype-filter";
import {Options as TransformOptions} from "./ast-to-react";
import React from 'react'
import {VFile} from 'vfile'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import PropTypes from 'prop-types'
import {html} from 'property-information'
import rehypeFilter from './rehype-filter.js'
import {uriTransformer} from './uri-transformer'
import {childrenToReact} from './ast-to-react'

export interface CoreOptions {
}

export interface PluginOptions {

}

interface LayoutOptions {

}

interface ReactMarkdownProps extends FilterOptions, TransformOptions {
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  className?: string;
}

interface Deprecation {
  id: string;
  to?: string;
}

const own = {}.hasOwnProperty
const changelog =
  'https://github.com/remarkjs/react-markdown/blob/main/changelog.md'

const deprecated: {[key: string]: Deprecation} = {
  renderers: {to: 'components', id: 'change-renderers-to-components'},
  astPlugins: {id: 'remove-buggy-html-in-markdown-parser'},
  allowDangerousHtml: {id: 'remove-buggy-html-in-markdown-parser'},
  escapeHtml: {id: 'remove-buggy-html-in-markdown-parser'},
  source: {to: 'children', id: 'change-source-to-children'},
  allowNode: {
    to: 'allowElement',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes'
  },
  allowedTypes: {
    to: 'allowedElements',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes'
  },
  disallowedTypes: {
    to: 'disallowedElements',
    id: 'replace-allownode-allowedtypes-and-disallowedtypes'
  },
  includeNodeIndex: {
    to: 'includeElementIndex',
    id: 'change-includenodeindex-to-includeelementindex'
  }
}

export const ReactMarkdown: React.FC<ReactMarkdownProps> = (options) => {
  for (const key in deprecated) {
    if (own.call(deprecated, key) && own.call(options, key)) {
      const deprecation = deprecated[key]
      console.warn(
        `[react-markdown] Warning: please ${
          deprecation.to ? `use \`${deprecation.to}\` instead of` : 'remove'
        } \`${key}\` (see <${changelog}#${deprecation.id}> for more info)`
      )
      delete deprecated[key]
    }
  }

  const processor = unified()
    .use(remarkParse)
    .use(options.remarkPlugins || [])
    .use(remarkRehype, {allowDangerousHtml: true})
    .use(options.rehypePlugins || [])
    .use(rehypeFilter, options)

  const file = new VFile()

  if (typeof options.children === 'string') {
    file.value = options.children
  } else if (options.children !== undefined && options.children !== null) {
    console.warn(
      `[react-markdown] Warning: please pass a string as \`children\` (not: \`${options.children}\`)`
    )
  }

  const hastNode = processor.runSync(processor.parse(file), file) as Root;

  if (hastNode.type !== 'root') {
    throw new TypeError('Expected a `root` node')
  }

  let result: ReactElement = React.createElement(
    React.Fragment,
    {},
    childrenToReact({options, schema: html, listDepth: 0}, hastNode)
  )

  if (options.className) {
    result = React.createElement('div', {className: options.className}, result)
  }

  return result
}

ReactMarkdown.defaultProps = {transformLinkUri: uriTransformer};

