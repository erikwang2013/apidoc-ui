/**
 * mock 模板的安全入口。
 *
 * better-mock 用 eval 解析占位符参数（如 `@pick(1, 2)` 会执行
 * `(function(){...})(1, 2)`），而 mock 模板来自接口文档、属于多用户可控数据，
 * 直接执行等于任意代码执行。这里只放行“字面量参数”语法：数字、字符串、正则、
 * 数组、布尔/null 与算术运算符；任何标识符、赋值、调用、模板字符串一律拒绝。
 * shortcut: mock 模板只支持字面量参数，复杂表达式会被静默丢弃；需要时再扩展白名单。
 */
import Mock from 'better-mock'

// 与 better-mock 内部 RE_PLACEHOLDER 保持一致
const PLACEHOLDER = /\\*@([^@#%&()?\s]+)(?:\((.*?)\))?/g

const KEYWORDS = /^(?:true|false|null|undefined|NaN|Infinity)\b/
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/
const OPERATORS = new Set(['+', '-', '*', '%', '!'])

/** 校验一个占位符的参数串（不含外层括号） */
export function isSafeMockArgs(input: string): boolean {
  if (!input.trim()) return true

  const n = input.length
  let i = 0
  let depth = 0
  let expectValue = true
  let justOpened = false

  while (i < n) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }
    // 库的正则以第一个 ')' 截断参数，出现括号必然不是合法参数
    if (ch === '(' || ch === ')') return false
    if (ch === ',') {
      if (expectValue) return false
      expectValue = true
      justOpened = false
      i++
      continue
    }
    if (ch === '[') {
      if (!expectValue) return false
      depth++
      expectValue = true
      justOpened = true
      i++
      continue
    }
    if (ch === ']') {
      if (depth === 0 || (expectValue && !justOpened)) return false
      depth--
      expectValue = false
      justOpened = false
      i++
      continue
    }
    if (ch === "'" || ch === '"') {
      if (!expectValue) return false
      const quote = ch
      i++
      let closed = false
      while (i < n) {
        const c = input[i]
        if (c === '\\') {
          i += 2
          continue
        }
        if (c === quote) {
          closed = true
          i++
          break
        }
        if (c === ')' || c === '\n' || c === '\r') return false
        i++
      }
      if (!closed) return false
      expectValue = false
      justOpened = false
      continue
    }
    if (ch === '/') {
      // 只接受正则字面量，顺带拒绝除法表达式
      if (!expectValue) return false
      i++
      let inClass = false
      let closed = false
      while (i < n) {
        const c = input[i]
        if (c === '\\') {
          i += 2
          continue
        }
        if (c === ')' || c === '\n' || c === '\r') return false
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) {
          closed = true
          i++
          break
        }
        i++
      }
      if (!closed) return false
      while (i < n && /[a-z]/i.test(input[i])) i++
      expectValue = false
      justOpened = false
      continue
    }

    const num = NUMBER.exec(input.slice(i))
    if (num) {
      if (!expectValue) return false
      i += num[0].length
      expectValue = false
      justOpened = false
      continue
    }
    const keyword = KEYWORDS.exec(input.slice(i))
    if (keyword) {
      if (!expectValue) return false
      i += keyword[0].length
      expectValue = false
      justOpened = false
      continue
    }
    if (OPERATORS.has(ch)) {
      expectValue = true
      justOpened = false
      i++
      continue
    }
    return false
  }

  return depth === 0 && !expectValue
}

/** 模板中的每个占位符参数都必须通过白名单校验 */
export function isSafeMockTemplate(template: unknown): boolean {
  if (typeof template !== 'string') return false
  PLACEHOLDER.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER.exec(template))) {
    // 反斜杠转义的占位符不会被执行
    if (match[0].startsWith('\\')) continue
    if (match[2] !== undefined && !isSafeMockArgs(match[2])) return false
  }
  return true
}

/** 模板不安全时返回空串，绝不把文档内容交给 eval */
export const safeMock = (template: unknown): any =>
  isSafeMockTemplate(template) ? Mock.mock(template as string) : ''
