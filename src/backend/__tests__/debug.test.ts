import { describe, expect, it, vi } from 'vitest'

vi.mock('/@/router', () => ({
  default: { currentRoute: { value: { query: {} } } },
}))

import { pollStream, sendRelay, startStream, stopStream } from '/@/pages/apiDetail/DebugTab/drivers/relay'
import type { DebugAdapter } from '../types'

const detail = { appKey: 'default', menuKey: 'ws%40chat' } as any
const input = { target: 'wss://x', payload: '', encoding: 'text' } as any

const makeAdapter = (): DebugAdapter => ({
  send: vi.fn(async () => ({ ok: true, body: 'x', encoding: 'text' as const })),
  start: vi.fn(async () => ({ ok: true, sessionId: 's1' })),
  poll: vi.fn(async () => ({ ok: true, messages: [] })),
  stop: vi.fn(async () => ({ ok: true })),
})

describe('relay adapter bridge', () => {
  it('routes unary calls through the adapter with the raw menuKey', async () => {
    const adapter = makeAdapter()
    const result = await sendRelay(adapter, detail, input)

    expect(result.ok).toBe(true)
    expect(adapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ appKey: 'default', path: 'ws%40chat' }),
    )
  })

  it('routes stream lifecycle through the adapter', async () => {
    const adapter = makeAdapter()

    expect((await startStream(adapter, detail, input)).sessionId).toBe('s1')
    await pollStream(adapter, detail, 's1')
    await stopStream(adapter, detail, 's1')

    expect(adapter.start).toHaveBeenCalledTimes(1)
    expect(adapter.poll).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }))
    expect(adapter.stop).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }))
  })
})
