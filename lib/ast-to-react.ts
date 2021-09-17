import React, {HTMLAttributeAnchorTarget, ReactNode} from 'react'
import ReactIs from 'react-is'
import {svg, find, hastToReact} from 'property-information'
import {stringify as spaces} from 'space-separated-tokens'
import {stringify as commas} from 'comma-separated-tokens'
import style from 'style-to-object'
import {DocType, Element, ElementContent, Root, Text, Comment} from 'hast'
import {Schema} from 'property-information'
import {NormalComponents, ReactMarkdownProps} from './complex-types'
import {Position} from 'unist'

interface Raw {
  type: 'raw';
  value: string;
}

interface Context {
  options: Options;
  schema: Schema
  listDepth: number
}

type TransformLink = (href: string, children: ElementContent[], title?: string) => string;
type TransformImage = (src: string, alt: string, title?: string) => string;
type TransformLinkTargetType = HTMLAttributeAnchorTarget;
type TransformLinkTarget = (href: string, children: ElementContent[], title?: string) => TransformLinkTargetType | undefined;
type ReactMarkdownNames = keyof JSX.IntrinsicElements;
type CodeComponent = (props: JSX.IntrinsicElements['code'] & ReactMarkdownProps & {inline?: boolean}) => ReactNode;
type HeadingComponent = (props: JSX.IntrinsicElements['h1'] & ReactMarkdownProps & {level: number}) => ReactNode;
type LiComponent = (props: JSX.IntrinsicElements['li'] & ReactMarkdownProps & {checked: boolean | null, index: number, ordered: boolean}) => ReactNode;
type OrderedListComponent = (props: JSX.IntrinsicElements['ol'] & ReactMarkdownProps & {depth: number, ordered: true}) => ReactNode;
type TableCellComponent = (props: JSX.IntrinsicElements['table'] & ReactMarkdownProps & {style?: {[key: string]: unknown}, isHeader: boolean}) => ReactNode
type TableRowComponent = (props: JSX.IntrinsicElements['tr'] & ReactMarkdownProps & {isHeader: boolean}) => ReactNode
type UnorderedListComponent = (props: JSX.IntrinsicElements['ul'] & ReactMarkdownProps & {depth: number, ordered: false}) => ReactNode

interface SpecialComponents {
  code: CodeComponent | ReactMarkdownNames;
  h1: HeadingComponent | ReactMarkdownNames;
  h2: HeadingComponent | ReactMarkdownNames;
  h3: HeadingComponent | ReactMarkdownNames;
  h4: HeadingComponent | ReactMarkdownNames;
  h5: HeadingComponent | ReactMarkdownNames
  h6: HeadingComponent | ReactMarkdownNames
  li: LiComponent | ReactMarkdownNames;
  ol: OrderedListComponent | ReactMarkdownNames;
  td: TableCellComponent | ReactMarkdownNames;
  th: TableCellComponent | ReactMarkdownNames;
  tr: TableRowComponent | ReactMarkdownNames;
  ul: UnorderedListComponent | ReactMarkdownNames;
}

type Components = Partial<Omit<NormalComponents, keyof SpecialComponents> & SpecialComponents>;

export interface Options {
  sourcePos?: boolean;
  rawSourcePos?: boolean;
  skipHtml?: boolean;
  includeElementIndex?: boolean;
  transformLinkUri?: null | false | TransformLink;
  transformImageUri?: TransformImage;
  linkTarget?: TransformLinkTargetType | TransformLinkTarget;
  components?: Components
}

const own = {}.hasOwnProperty

// The table-related elements that must not contain whitespace text according
// to React.
const tableElements = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

export function childrenToReact(context: Context, node: Element | Root) {
  const children: ReactNode[] = []
  let childIndex = -1
  let child: Comment | DocType | Element | Raw | Text

  while (++childIndex < node.children.length) {
    child = node.children[childIndex]

    if (child.type === 'element') {
      children.push(toReact(context, child, childIndex, node))
    } else if (child.type === 'text') {
      // React does not permit whitespace text elements as children of table:
      // cf. https://github.com/remarkjs/react-markdown/issues/576
      if (
        node.type !== 'element' ||
        !tableElements.has(node.tagName) ||
        child.value !== '\n'
      ) {
        children.push(child.value)
      }
    } else if (child.type === 'raw' && !context.options.skipHtml) {
      // Default behavior is to show (encoded) HTML.
      children.push(child.value)
    }
  }

  return children
}

function toReact(context: Context, node: Element, index: number, parent: Element | Root) {
  const options = context.options
  const parentSchema = context.schema
  const name: ReactMarkdownNames = node.tagName as ReactMarkdownNames;
  const properties: {
    [key: string]: unknown;
    style?: {[key: string]: unknown}
  } = {}
  let schema = parentSchema
  let property: string

  if (parentSchema.space === 'html' && name === 'svg') {
    schema = svg
    context.schema = schema
  }

  if (node.properties) {
    for (property in node.properties) {
      if (own.call(node.properties, property)) {
        addProperty(properties, property, node.properties[property], context)
      }
    }
  }

  if (name === 'ol' || name === 'ul') {
    context.listDepth++
  }

  const children = childrenToReact(context, node)

  if (name === 'ol' || name === 'ul') {
    context.listDepth--
  }

  // Restore parent schema.
  context.schema = parentSchema

  // Nodes created by plugins do not have positional info, in which case we use
  // an object that matches the position interface.
  const position = node.position || {
    start: {line: null, column: null, offset: null},
    end: {line: null, column: null, offset: null}
  }
  const component =
    options.components && own.call(options.components, name)
      ? options.components[name]
      : name
  const basic = typeof component === 'string' || component === React.Fragment

  if (!ReactIs.isValidElementType(component)) {
    throw new TypeError(
      `Component for name \`${name}\` not defined or is not renderable`
    )
  }

  properties.key = [
    name,
    position.start.line,
    position.start.column,
    index
  ].join('-')

  if (name === 'a' && options.linkTarget) {
    properties.target =
      typeof options.linkTarget === 'function'
        ? options.linkTarget(
          String(properties.href || ''),
          node.children,
          typeof properties.title === 'string' ? properties.title : undefined
        )
        : options.linkTarget
  }

  if (name === 'a' && options.transformLinkUri) {
    properties.href = options.transformLinkUri(
      String(properties.href || ''),
      node.children,
      typeof properties.title === 'string' ? properties.title : undefined
    )
  }

  if (
    !basic &&
    name === 'code' &&
    parent.type === 'element' &&
    parent.tagName !== 'pre'
  ) {
    properties.inline = true
  }

  if (
    !basic &&
    (name === 'h1' ||
      name === 'h2' ||
      name === 'h3' ||
      name === 'h4' ||
      name === 'h5' ||
      name === 'h6')
  ) {
    properties.level = Number.parseInt(name.charAt(1), 10)
  }

  if (name === 'img' && options.transformImageUri) {
    properties.src = options.transformImageUri(
      String(properties.src || ''),
      String(properties.alt || ''),
      typeof properties.title === 'string' ? properties.title : undefined
    )
  }

  if (!basic && name === 'li' && parent.type === 'element') {
    const input = getInputElement(node)
    properties.checked =
      input && input.properties ? Boolean(input.properties.checked) : null
    properties.index = getElementsBeforeCount(parent, node)
    properties.ordered = parent.tagName === 'ol'
  }

  if (!basic && (name === 'ol' || name === 'ul')) {
    properties.ordered = name === 'ol'
    properties.depth = context.listDepth
  }

  if (name === 'td' || name === 'th') {
    if (properties.align) {
      if (!properties.style) properties.style = {}
      properties.style.textAlign = properties.align
      delete properties.align
    }

    if (!basic) {
      properties.isHeader = name === 'th'
    }
  }

  if (!basic && name === 'tr' && parent.type === 'element') {
    properties.isHeader = Boolean(parent.tagName === 'thead')
  }

  // If `sourcePos` is given, pass source information (line/column info from markdown source).
  if (options.sourcePos) {
    properties['data-sourcepos'] = flattenPosition(position)
  }

  if (!basic && options.rawSourcePos) {
    properties.sourcePosition = node.position
  }

  // If `includeElementIndex` is given, pass node index info to components.
  if (!basic && options.includeElementIndex) {
    properties.index = getElementsBeforeCount(parent, node)
    properties.siblingCount = getElementsBeforeCount(parent)
  }

  if (!basic) {
    properties.node = node
  }

  // Ensure no React warnings are emitted for void elements w/ children.
  return children.length > 0
    ? React.createElement(component, properties, children)
    : React.createElement(component, properties)
}

function getInputElement(node: Element | Root): Element | null {
  let index = -1

  while (++index < node.children.length) {
    const child = node.children[index]

    if (child.type === 'element' && child.tagName === 'input') {
      return child
    }
  }

  return null;
}

function getElementsBeforeCount(parent: Element | Root, node?: Element): number {
  let index = -1
  let count = 0

  while (++index < parent.children.length) {
    if (parent.children[index] === node) break
    if (parent.children[index].type === 'element') count++
  }

  return count
}

function addProperty(props: {[key: string]: unknown}, prop: string, value: unknown, ctx: Context) {
  const info = find(ctx.schema, prop)
  let result = value

  // Ignore nullish and `NaN` values.
  // eslint-disable-next-line no-self-compare
  if (result === null || result === undefined || result !== result) {
    return
  }

  // Accept `array`.
  // Most props are space-separated.
  if (Array.isArray(result)) {
    result = info.commaSeparated ? commas(result) : spaces(result)
  }

  if (info.property === 'style' && typeof result === 'string') {
    result = parseStyle(result)
  }

  if (info.space && info.property) {
    props[
      own.call(hastToReact, info.property)
        ? hastToReact[info.property as keyof typeof hastToReact]
        : info.property
      ] = result
  } else if (info.attribute) {
    props[info.attribute] = result
  }
}

function parseStyle(value: string): {[key: string]: string} {
  const result: {[key: string]: string} = {}

  try {
    style(value, iterator)
  } catch {
    // Silent.
  }

  return result

  function iterator(name: string, v: string) {
    const k = name.slice(0, 4) === '-ms-' ? `ms-${name.slice(4)}` : name
    result[k.replace(/-([a-z])/g, styleReplacer)] = v
  }
}

function styleReplacer(_: unknown, $1: string) {
  return $1.toUpperCase()
}

function flattenPosition(pos: Position | {start: {line: null, column: null, offset: null}, end: {line: null, column: null, offset: null}}): string {
  return [
    pos.start.line,
    ':',
    pos.start.column,
    '-',
    pos.end.line,
    ':',
    pos.end.column
  ]
    .map((d) => String(d))
    .join('')
}
