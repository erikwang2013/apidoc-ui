import { describe, expect, it } from 'vitest'
import { debugModeEnabled, featureEnabled } from '../gating'
import type { Capabilities } from '../types'

const caps = {
  features: {
    share: { records: false },
    cache: { manage: true },
    debug: { modes: ['browser-http'] },
  },
} as unknown as Capabilities

describe('capability gating', () => {
  it('hides share records when unsupported', () => {
    expect(featureEnabled(caps, 'share.records')).toBe(false)
  })

  it('enables supported booleans', () => {
    expect(featureEnabled(caps, 'cache.manage')).toBe(true)
  })

  it('defaults missing paths and unknown backends to false/true respectively', () => {
    expect(featureEnabled(caps, 'generator.forms')).toBe(false)
    expect(featureEnabled(undefined, 'share.records')).toBe(true)
  })

  it('checks debug modes', () => {
    expect(debugModeEnabled(caps, 'browser-http')).toBe(true)
    expect(debugModeEnabled(caps, 'relay-stream')).toBe(false)
    expect(debugModeEnabled(undefined, 'relay-stream')).toBe(true)
  })
})
