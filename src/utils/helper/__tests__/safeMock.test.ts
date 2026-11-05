import { describe, expect, it } from 'vitest'
import { isSafeMockArgs, isSafeMockTemplate, safeMock } from '../safeMock'

describe('safeMock', () => {
  it('keeps plain text and generates safe placeholders', () => {
    expect(safeMock('erik')).toBe('erik')
    expect(safeMock('@name')).toEqual(expect.any(String))
    expect([1, 2, 3]).toContain(safeMock('@integer(1, 3)'))
    expect(['a', 'b']).toContain(safeMock("@pick(['a', 'b'])"))
  })

  it('allows literals, arrays and regex arguments', () => {
    for (const arg of [
      '1, 100',
      '-10, 10',
      "'yyyy-MM-dd'",
      'true',
      '[1, 2, 3]',
      "['a', 'b']",
      '[]',
      '/^[a-z]{3}$/',
      '/^\\d{3}-\\d{4}$/i',
      " '200x100', '#50B347' ",
      '',
    ]) {
      expect(isSafeMockArgs(arg)).toBe(true)
    }
  })

  it('rejects executable placeholder arguments', () => {
    const payloads = [
      '@pick(globalThis.__safeMockPwned=1)',
      '@pick(1, globalThis.__safeMockPwned=1)',
      '@pick([1], location="//evil")',
      '@pick(1;globalThis.__safeMockPwned=1)',
      '@pick(`x`)',
      '@pick(alert(1))',
      '@pick((globalThis.__safeMockPwned=1))',
      '@pick({a: 1})',
      '@pick(document.cookie)',
      '@pick(fetch)',
      '@pick(1/2)',
    ]
    for (const payload of payloads) {
      expect(isSafeMockTemplate(payload)).toBe(false)
      ;(globalThis as any).__safeMockPwned = false
      expect(safeMock(payload)).toBe('')
      expect((globalThis as any).__safeMockPwned).toBe(false)
    }
    delete (globalThis as any).__safeMockPwned
  })

  it('skips backslash-escaped placeholders', () => {
    expect(isSafeMockTemplate('\\@pick(globalThis.__safeMockPwned=1)')).toBe(true)
    expect(safeMock('\\@pick(globalThis.__safeMockPwned=1)')).not.toBe('')
  })

  it('rejects non-string templates', () => {
    expect(isSafeMockTemplate({ '@pick': 1 })).toBe(false)
    expect(safeMock({ '@pick': 1 })).toBe('')
  })
})
