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

/** 同 channel 同方向多条消息：AsyncAPI 2.6 用 messages 数组，单条用 message */
function addOperation(
  channel: Obj,
  address: string,
  direction: 'publish' | 'subscribe',
  incoming: Obj[],
) {
  const existing = channel[direction]
  const messages = existing
    ? [...(existing.messages || [existing.message]), ...incoming]
    : incoming
  channel[direction] =
    messages.length === 1
      ? { operationId: operationId(address, direction), message: messages[0] }
      : { operationId: operationId(address, direction), messages }
}

const messagesOf = (detail: ApiDetailResult): ApiMessageInfo[] =>
  (detail.definitions || []).flatMap((def) => def.messages || [])

export function buildAsyncApiJson(nodes: DocNode[], title: string): Obj {
  const channels: Obj = {}
  nodes.forEach((node) => {
    if (node.kind !== 'api' || !node.detail) return
    const detail = node.detail
    if (!ASYNC_PROTOCOLS.has(detail.protocol?.name || '')) return
    const address = detail.channel?.address || node.url
    if (!address) return
    const channel = (channels[address] = channels[address] || {})
    const publish: Obj[] = []
    const subscribe: Obj[] = []
    messagesOf(detail).forEach((msg) => {
      const target = PUBLISH_DIRECTIONS.has(String(msg.direction)) ? publish : subscribe
      target.push({ name: msg.name, payload: payloadOf(msg.fields) })
    })
    if (!publish.length && !subscribe.length) {
      // 无定义文件（如 webhook）：按 channel.action 合成一条消息。
      const action = String(detail.channel?.action || '').toLowerCase()
      const direction = PUBLISH_ACTIONS.some((a) => action.includes(a)) ? 'publish' : 'subscribe'
      const fields = direction === 'publish' ? detail.param : detail.responseSuccess || detail.param
      addOperation(channel, address, direction, [
        { name: node.title || address, payload: payloadOf(fields) },
      ])
      return
    }
    if (publish.length) addOperation(channel, address, 'publish', publish)
    if (subscribe.length) addOperation(channel, address, 'subscribe', subscribe)
  })
  return { asyncapi: '2.6.0', info: { title, version: '1.0.0' }, channels }
}
