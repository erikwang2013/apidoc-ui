import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ApiDetailResult } from '/@/api/apidocApi/types'
import { buildAsyncApiJson } from '../asyncapi'
import type { DocNode } from '../collect'

const fixtures = JSON.parse(
  readFileSync(new URL('../../../../contract/uic-1/fixtures/detail.json', import.meta.url), 'utf8'),
)

const detailOf = (name: string): ApiDetailResult =>
  fixtures.find((row: any) => row.name === name).response.data

const nodeOf = (detail: ApiDetailResult): DocNode => ({
  kind: 'api',
  appKey: 'default',
  appTitle: 'Default',
  group: [],
  title: detail.title,
  method: Array.isArray(detail.method) ? detail.method.join('/') : detail.method,
  url: detail.url,
  detail,
})

describe('buildAsyncApiJson', () => {
  it('maps definition messages to publish/subscribe channels', () => {
    const ws = detailOf('php-ws-chat')
    const doc = buildAsyncApiJson([nodeOf(ws)], 'Demo')

    expect(doc.asyncapi).toBe('2.6.0')
    expect(doc.info.title).toBe('Demo')
    const channel = doc.channels['wss://example.com/chat']
    expect(channel.publish.operationId).toBe('wss_example_com_chat_publish')
    expect(channel.publish.message.name).toBe('join')
    expect(channel.publish.message.payload.properties.room.type).toBe('string')
    expect(channel.subscribe).toBeUndefined()
  })

  it('skips HTTP endpoints', () => {
    expect(buildAsyncApiJson([nodeOf(detailOf('php-http-get-users'))], 'Demo').channels).toEqual(
      {},
    )
  })

  it('splits multiple messages on one address into single-message operations', () => {
    const ws: ApiDetailResult = {
      menuKey: 'ws%40chat',
      name: 'chat',
      title: 'Chat',
      method: 'WS',
      url: 'wss://example.com/chat',
      protocol: { name: 'websocket', label: 'WebSocket' },
      channel: { address: 'wss://example.com/chat', action: 'connect' },
      definitions: [
        {
          format: 'asyncapi',
          source: 'inline',
          messages: [
            { name: 'join', direction: 'request', fields: [] },
            { name: 'leave', direction: 'request', fields: [] },
            { name: 'joined', direction: 'response', fields: [] },
          ],
          validation: { ok: true, errors: [], warnings: [] },
        },
      ],
    } as ApiDetailResult

    const doc = buildAsyncApiJson([nodeOf(ws)], 'Demo')
    const channels = Object.values(doc.channels) as any[]
    // 2.6 每条 operation 只能有一个 message；同地址的多条消息拆成独立 channel。
    expect(channels).toHaveLength(3)
    const operations = channels.flatMap((c) => [c.publish, c.subscribe].filter((op) => !!op))
    expect(operations.map((op) => op.operationId)).toEqual(
      expect.arrayContaining([
        'wss_example_com_chat_publish_1',
        'wss_example_com_chat_publish_2',
        'wss_example_com_chat_subscribe_1',
      ]),
    )
    operations.forEach((op) => {
      expect(op.message).toBeTruthy()
      expect(op.messages).toBeUndefined()
    })
  })

  it('synthesizes a subscribe message when there is no definition', () => {
    const mqtt: ApiDetailResult = {
      menuKey: 'mqtt%40temp',
      name: 'temp',
      title: 'Temperature',
      method: 'SUB',
      url: 'mqtt://broker/sensors/temp',
      protocol: { name: 'mqtt', label: 'MQTT' },
      channel: { address: 'sensors/temp', action: 'subscribe' },
      responseSuccess: [{ name: 'value', type: 'int', require: true }],
    }
    const channel = buildAsyncApiJson([nodeOf(mqtt)], 'Demo').channels['sensors/temp']

    expect(channel.subscribe.operationId).toBe('sensors_temp_subscribe')
    expect(channel.subscribe.message.payload.properties.value.type).toBe('integer')
  })
})
