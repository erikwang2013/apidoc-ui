import { describe, expect, it } from 'vitest'
import { authKey, normalizeHost } from '../../utils/helper/authKey'

describe('authKey', () => {
  it('separates hosts', () => {
    expect(authKey('https://a', 'app')).not.toBe(authKey('https://b', 'app'))
  })

  it('normalizes trailing slashes and empty hosts', () => {
    expect(normalizeHost('https://a/')).toBe('https://a')
    expect(normalizeHost('')).toBe('same-origin')
    expect(authKey('https://a/', 'global')).toBe('https://a|global')
  })

  it('keeps scopes separate on the same host', () => {
    expect(authKey('https://a', 'app')).not.toBe(authKey('https://a', 'global'))
  })
})
