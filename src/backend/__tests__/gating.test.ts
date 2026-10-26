import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { debugModeEnabled, featureEnabled, generatorToolsVisible } from '../gating'
import type { Capabilities } from '../types'

const caps = {
  features: {
    share: { records: false },
    cache: { manage: true },
    debug: { modes: ['browser-http'] },
  },
} as unknown as Capabilities

const capabilityFixtures: Array<{ name: string; response: { data: Capabilities } }> = JSON.parse(
  readFileSync(
    new URL('../../../contract/uic-1/fixtures/capabilities.json', import.meta.url),
    'utf8',
  ),
)
const fixtureCaps = (name: string) =>
  capabilityFixtures.find((row) => row.name === name)!.response.data

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

  it('gates the generator entry on the forms capability and configured generators', () => {
    const generators = [{ title: 'axios' }]
    expect(generatorToolsVisible(fixtureCaps('php-full'), generators)).toBe(true)
    expect(generatorToolsVisible(undefined, generators)).toBe(true)
    expect(generatorToolsVisible(fixtureCaps('php-full'), [])).toBe(false)

    const base = fixtureCaps('go-phase1')
    const noForms: Capabilities = {
      ...base,
      features: {
        ...base.features,
        generator: { ...base.features.generator, forms: false },
      },
    }
    expect(generatorToolsVisible(noForms, generators)).toBe(false)
  })

  it('checks debug modes', () => {
    expect(debugModeEnabled(caps, 'browser-http')).toBe(true)
    expect(debugModeEnabled(caps, 'relay-stream')).toBe(false)
    expect(debugModeEnabled(undefined, 'relay-stream')).toBe(true)
  })
})
