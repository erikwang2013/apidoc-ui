/**
 * 导出渲染：DocNode[] → AsyncAPI 2.6 JSON（从 protocol/channel/definitions 推导）。
 * 只导出有 channel 语义的流式/事件协议；HTTP 与一元 RPC 没有 AsyncAPI 位置。
 * 方向：out/request = 客户端发送 → publish；in/response/event/notification = subscribe。
 */
import type { ApiDetailResult, ApiMessageInfo } from '/@/api/apidocApi/types'
import type { DocNode } from './collect'
import { rowsSchema } from './json'

type Obj = Record<string, any>

const ASYNC_PROTOCOLS = new Set([
  'websocket',
  'ws-binary',
  'sse',
  'socketio',
  'stomp',
  'stomp-binary',
  'mqtt',
  'amqp',
  'kafka',
  'webhook',
])

const PUBLISH_DIRECTIONS = new Set(['out', 'request'])
const PUBLISH_ACTIONS = ['publish', 'produce', 'send']

const payloadOf = (fields: ApiDetailResult['param']): Obj =>
  rowsSchema(fields) || { type: 'object' }

function operationId(channel: string, direction: string): string {
  const id = channel.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return id ? `${id}_${direction}` : `channel_${direction}`
}

type Direction = 'publish' | 'subscribe'
type PendingChannel = Record<Direction, Obj[]>

const directionsOf = (pending: PendingChannel): Array<[Direction, Obj[]]> => [
  ['publish', pending.publish],
  ['subscribe', pending.subscribe],
]

const messagesOf = (detail: ApiDetailResult): ApiMessageInfo[] =>
  (detail.definitions || []).flatMap((def) => def.messages || [])

export function buildAsyncApiJson(nodes: DocNode[], title: string): Obj {
  const pending: Record<string, PendingChannel> = {}
  nodes.forEach((node) => {
    if (node.kind !== 'api' || !node.detail) return
    const detail = node.detail
    if (!ASYNC_PROTOCOLS.has(detail.protocol?.name || '')) return
    const address = detail.channel?.address || node.url
    if (!address) return
    const bucket = (pending[address] = pending[address] || { publish: [], subscribe: [] })
    const messages = messagesOf(detail)
    if (!messages.length) {
      // 无定义文件（如 webhook）：按 channel.action 合成一条消息。
      const action = String(detail.channel?.action || '').toLowerCase()
      const direction = PUBLISH_ACTIONS.some((a) => action.includes(a)) ? 'publish' : 'subscribe'
      const fields = direction === 'publish' ? detail.param : detail.responseSuccess || detail.param
      bucket[direction].push({ name: node.title || address, payload: payloadOf(fields) })
      return
    }
    messages.forEach((msg) => {
      const target = PUBLISH_DIRECTIONS.has(String(msg.direction))
        ? bucket.publish
        : bucket.subscribe
      target.push({ name: msg.name, payload: payloadOf(msg.fields) })
    })
  })

  const channels: Obj = {}
  Object.keys(pending).forEach((address) => {
    const channel = pending[address]
    if (channel.publish.length <= 1 && channel.subscribe.length <= 1) {
      const item: Obj = {}
      directionsOf(channel).forEach(([direction, messages]) => {
        if (messages.length) {
          item[direction] = { operationId: operationId(address, direction), message: messages[0] }
        }
      })
      channels[address] = item
      return
    }
    // AsyncAPI 2.6 的 Operation.message 是单值：同地址多条消息各拆一个 channel 条目。
    directionsOf(channel).forEach(([direction, messages]) => {
      messages.forEach((message, index) => {
        channels[`${address}~${direction}_${index + 1}`] = {
          [direction]: {
            operationId: `${operationId(address, direction)}_${index + 1}`,
            message,
          },
        }
      })
    })
  })
  return { asyncapi: '2.6.0', info: { title, version: '1.0.0' }, channels }
}
