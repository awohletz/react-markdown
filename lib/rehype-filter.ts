import {visit} from 'unist-util-visit'
import {Element, Root} from 'hast'
import {Plugin} from 'unified'
import {Node} from 'unist'

type AllowElement = (element: Element, index: number, parent: Element | Root | null) => boolean | undefined;

export interface Options {
  allowedElements?: string[];
  disallowedElements?: string[];
  allowElement?: AllowElement;
  unwrapDisallowed?: boolean;
}

export default function rehypeFilter(options: Options) {
  if (options.allowedElements && options.disallowedElements) {
    throw new TypeError(
      'Only one of `allowedElements` and `disallowedElements` should be defined'
    )
  }

  if (
    options.allowedElements ||
    options.disallowedElements ||
    options.allowElement
  ) {
    return (tree: Node) => {
      visit(tree, 'element', (node: Element, index, parent_) => {
        const parent = parent_ as Element | Root | null
        let remove: boolean | undefined

        if (options.allowedElements) {
          remove = !options.allowedElements.includes(node.tagName)
        } else if (options.disallowedElements) {
          remove = options.disallowedElements.includes(node.tagName)
        }

        if (!remove && options.allowElement && typeof index === 'number') {
          remove = !options.allowElement(node, index, parent)
        }

        if (remove && typeof index === 'number') {
          if (options.unwrapDisallowed && node.children) {
            parent?.children.splice(index, 1, ...node.children)
          } else {
            parent?.children.splice(index, 1)
          }

          return index
        }

        return undefined
      })
    }
  }
}
