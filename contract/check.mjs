import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const names = [
  'capabilities',
  'config',
  'menus',
  'detail',
  'docs',
  'debug',
  'share',
  'generator',
  'export',
  'cache',
]

const load = (name) =>
  JSON.parse(readFileSync(new URL(`./uic-1/fixtures/${name}.json`, import.meta.url), 'utf8'))

const checks = {
  capabilities: (data) => {
    assert.equal(data.contract, '1.0')
    assert.ok(['php', 'go', 'rust'].includes(data.backend))
    assert.equal(typeof data.features, 'object')
    assert.ok(Array.isArray(data.features.debug.modes))
  },
  config: (data) => {
    assert.ok(Array.isArray(data.apps))
    assert.ok(data.apps.length > 0)
    assert.equal(typeof data.apps[0].key, 'string')
  },
  menus: (data) => {
    assert.ok(data.app)
    assert.ok(Array.isArray(data.data))
    assert.ok(data.data.length > 0)
  },
  detail: (data) => {
    assert.equal(typeof data.menuKey, 'string')
    assert.ok(data.method)
    assert.equal(typeof data.url, 'string')
    assert.equal(typeof data.protocol, 'object')
    assert.equal(typeof data.debug, 'object')
  },
  docs: (data) => {
    if (Array.isArray(data)) return
    assert.equal(typeof data.content, 'string')
  },
  debug: (data) => {
    assert.equal(typeof data.ok, 'boolean')
  },
  share: (data) => {
    if (data === true) return
    assert.equal(typeof data, 'object')
    if (Array.isArray(data.data)) assert.equal(typeof data.total, 'number')
  },
  generator: (data) => {
    if (Array.isArray(data.files)) return
    assert.equal(typeof data.code, 'string')
  },
  export: (data) => {
    if (Array.isArray(data.apiData)) return
    if (data.openapi === '3.0.0') return
    assert.equal(data.asyncapi, '2.6.0')
  },
  cache: (data) => {
    assert.equal(typeof data.ok, 'boolean')
    assert.ok(['server', 'build'].includes(data.mode))
  },
}

for (const name of names) {
  const fixtures = load(name)
  assert.ok(Array.isArray(fixtures) && fixtures.length > 0, `${name}: no fixtures`)
  const seen = new Set()
  for (const fixture of fixtures) {
    assert.equal(typeof fixture.name, 'string', `${name}: fixture name`)
    assert.ok(!seen.has(fixture.name), `${name}: duplicate ${fixture.name}`)
    seen.add(fixture.name)
    assert.equal(fixture.response.code, 0, `${name}:${fixture.name} code`)
    assert.equal(typeof fixture.response.message, 'string', `${name}:${fixture.name} message`)
    assert.notEqual(fixture.response.data, undefined, `${name}:${fixture.name} data`)
    checks[name](fixture.response.data)
  }
}

console.log(`checked ${names.length} fixture files`)
