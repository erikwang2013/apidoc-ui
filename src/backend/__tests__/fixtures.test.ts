import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

const load = async (name: string) =>
  JSON.parse(
    await readFile(
      new URL(`../../../contract/uic-1/fixtures/${name}.json`, import.meta.url),
      'utf8',
    ),
  )

describe('contract fixtures', () => {
  it('loads menus', async () => {
    const rows = await load('menus')
    expect(rows[0].response.data.app).toBeTruthy()
  })

  it('loads capabilities', async () => {
    const rows = await load('capabilities')
    expect(rows[0].response.data.contract).toBe('1.0')
  })
})
