import compile from './compile'
import validate from './validate'
import { fromServer } from './server'

function createStyleSheet(rules) {
  const cache = typeof Map === 'undefined' ? null : new Map()
  return {
    create: styles => {
      if (cache) {
        const cached = cache.get(styles)
        if (cached) {
          return cached
        }
      }
      const locals = {}

      for (const token in styles) {
        const rule = styles[token]
        if (process.env.NODE_ENV !== 'production') {
          validate(rule, null)
        }
        const compiled = compile(rule)
        locals[token] = Object.keys(compiled)
        Object.assign(rules, compiled)
      }

      if (cache) {
        cache.set(styles, locals)
      }

      return locals
    },
  }
}

function concatClassName(dest, className) {
  if (className.substr(0, 4) !== 'dss_') {
    return { shouldInject: false, className: `${className} ${dest}` }
  }
  const property = className.substr(0, className.indexOf('-'))
  if (dest.indexOf(property) > -1) {
    return { shouldInject: false, className: dest }
  }
  return { shouldInject: true, className: `${dest} ${className}` }
}

function createStyleResolver(sheets, rules) {
  const { sheet, mediaSheet } = sheets
  const serverStyles = fromServer(sheets)
  const resolved = {}
  const injected = {}

  return {
    getStyleSheet() {
      return sheets
    },
    resolve(style) {
      const stylesToString = style.join()

      if (resolved[stylesToString]) {
        return resolved[stylesToString]
      }

      let className = ''

      for (let i = style.length - 1; i >= 0; i--) {
        let current = style[i]
        if (!current) {
          continue
        }
        if (typeof current === 'string') {
          current = [current]
        }
        current.forEach(current => {
          const result = concatClassName(className, current)
          className = result.className
          if (result.shouldInject && !injected[current]) {
            const rule = rules[current]
            if (rule && serverStyles.indexOf(current) === -1) {
              ;(rule.charAt(0) === '@' ? mediaSheet : sheet).insertRule(rule)
            }
            injected[current] = true
          }
        })
      }

      resolved[stylesToString] = className.trim()
      return resolved[stylesToString]
    },
  }
}

export function createSheets(document = window.document) {
  const style = document.createElement('style')
  const mediaStyle = document.createElement('style')
  document.head.appendChild(style)
  document.head.appendChild(mediaStyle)

  return {
    get sheet() {
      return style.sheet
    },
    get mediaSheet() {
      return mediaStyle.sheet
    },
  }
}

export function create(sheets = createSheets()) {
  const rules = {}

  if (!sheets.sheet || !sheets.mediaSheet) {
    throw new Error(
      `Create must be called with an object that contains two objects, sheet and mediaSheet,
      that implement the CSSStyleSheet interface.

      To preserve determinism media queries should be inserted in a separate style sheet,
      after the main sheet.
    `
    )
  }

  // Moves link tag between the two style tags so that:
  // 1. new regular rules are appended before
  // 2. new at rules are appended after
  // This is necessary to preserve determinism due to specificity.
  const linkNode = sheets.linkSheet && sheets.linkSheet.ownerNode
  if (linkNode) {
    linkNode.parentNode.insertBefore(linkNode, sheets.mediaSheet.ownerNode)
  }

  return {
    StyleSheet: createStyleSheet(rules),
    StyleResolver: createStyleResolver(sheets, rules),
  }
}
