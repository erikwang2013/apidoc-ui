import { describe, expect, it } from 'vitest'
import { isHttpUrl, isSafeDownloadUrl } from '../index'

describe('url guards', () => {
  it('allows only absolute http(s) URLs', () => {
    expect(isHttpUrl('https://example.com/a')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isHttpUrl('/relative')).toBe(false)
  })

  it('blocks script schemes for downloads', () => {
    expect(isSafeDownloadUrl('https://example.com/a.zip')).toBe(true)
    expect(isSafeDownloadUrl('/file.zip')).toBe(true)
    expect(isSafeDownloadUrl('blob:https://example.com/x')).toBe(true)
    expect(isSafeDownloadUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeDownloadUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeDownloadUrl('')).toBe(false)
  })
})
