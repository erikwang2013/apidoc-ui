<template>
  <div class="protocol-debug">
    <div class="protocol-debug-meta">
      <protocol-badge
        :protocol="props.detail.protocol"
        :protocolKey="props.detail.protocolKey"
        :protocolLabel="props.detail.protocolLabel"
      />
      <a-tag>{{ debug?.mode }}</a-tag>
      <a-tag :color="debug?.relayEnabled ? 'green' : 'default'">
        relay: {{ debug?.relayEnabled ? 'on' : 'off' }}
      </a-tag>
      <span class="protocol-debug-target">
        {{ t('apiPage.debug.protocolTarget') }}: {{ state.model.target }}
      </span>
    </div>
    <a-alert
      v-if="debug && (!debug.debuggable || (isRelay && !debug.relayEnabled))"
      type="warning"
      :message="debug.debugReason || t('apiPage.debug.protocolRelayDisabled')"
    />
    <div v-if="isRelay" class="protocol-debug-relay">
      <protocol-fields ref="fieldsRef" v-model="state.model" :detail="props.detail" />
      <div class="protocol-debug-actions">
        <template v-if="isRelayStream">
          <a-button v-if="state.streaming" danger @click="onStopStream">
            {{ t('apiPage.debug.protocolDisconnect') }}
          </a-button>
          <a-button
            v-else
            type="primary"
            :disabled="relayDisabled"
            :loading="state.sending"
            @click="onStartStream"
          >
            {{ t('apiPage.debug.protocolConnect') }}
          </a-button>
          <a-tag :color="state.streaming ? 'green' : 'default'">
            {{ state.streaming ? '●' : '○' }}
          </a-tag>
        </template>
        <a-button
          v-else
          type="primary"
          :disabled="relayDisabled"
          :loading="state.sending"
          @click="onSendRelay"
        >
          {{ t('apiPage.debug.protocolSend') }}
        </a-button>
      </div>
      <response-log :entries="state.log" />
    </div>
    <template v-else>
      <protocol-fields ref="fieldsRef" v-model="state.model" :detail="props.detail" />
      <div class="protocol-debug-actions">
        <a-button type="primary" :disabled="!debug?.debuggable" @click="onConnect">
          {{
            state.connected
              ? t('apiPage.debug.protocolDisconnect')
              : t('apiPage.debug.protocolConnect')
          }}
        </a-button>
        <span class="protocol-debug-status">
          {{ t('apiPage.debug.protocolStatus') }}:
          <a-tag :color="state.connected ? 'green' : 'default'">
            {{ state.connected ? '●' : '○' }}
          </a-tag>
        </span>
      </div>
      <template v-if="isWebSocket">
        <a-textarea
          v-model:value="state.message"
          class="protocol-debug-message"
          :rows="3"
          placeholder="Payload"
        />
        <div class="protocol-debug-actions">
          <a-button :disabled="!state.connected" @click="onSend">
            {{ t('apiPage.debug.protocolSend') }}
          </a-button>
          <span class="protocol-debug-status">
            {{ t('apiPage.debug.protocolEncoding') }}: {{ state.model.encoding }}
          </span>
        </div>
      </template>
      <response-log :entries="state.log" />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { message } from 'ant-design-vue'
  import ProtocolBadge from '/@/components/ProtocolBadge'
  import { ApiDebugResult, ApiDetailResult } from '/@/api/apidocApi/types'
  import { useI18n } from '/@/hooks/useI18n'
  import ProtocolFields from './ProtocolFields.vue'
  import ResponseLog from './ResponseLog.vue'
  import { BrowserWebSocketDriver } from './drivers/browserWebSocket'
  import { BrowserSseDriver } from './drivers/browserSse'
  import { createLogEntry, DebugLogEntry, ProtocolDebugModel } from './drivers/types'
  import {
    pollStream,
    RelayStartResult,
    RelayStreamMessage,
    sendRelay,
    startStream,
    stopStream,
  } from './drivers/relay'

  const props = withDefaults(defineProps<{ detail: ApiDetailResult }>(), {})
  const { t } = useI18n()

  const debug = computed(() => props.detail.debug)
  const isRelay = computed(() => (debug.value?.mode ?? '').startsWith('relay-'))
  const isRelayStream = computed(() => debug.value?.mode === 'relay-stream')
  const isWebSocket = computed(() => debug.value?.mode === 'browser-websocket')
  const relayDisabled = computed(() => !debug.value?.relayEnabled || !debug.value?.debuggable)

  const fieldsRef = ref()

  const state = reactive<{
    model: ProtocolDebugModel
    message: string
    log: DebugLogEntry[]
    connected: boolean
    sending: boolean
    streaming: boolean
    sessionId: string
  }>({
    model: {
      target: String(debug.value?.defaults?.target ?? ''),
      headers: {},
      query: {},
      fields: {},
      payload: '',
      encoding: 'text',
      timeout: 5,
    },
    message: '',
    log: [],
    connected: false,
    sending: false,
    streaming: false,
    sessionId: '',
  })

  const incoming = (entry: DebugLogEntry): DebugLogEntry => {
    const encoding = debug.value?.responseEncoding
    if (entry.direction === 'in' && entry.encoding === 'text' && encoding && encoding !== 'text') {
      return { ...entry, encoding }
    }
    return entry
  }

  const wsDriver = new BrowserWebSocketDriver({
    onOpen: () => {
      state.connected = true
    },
    onMessage: (entry) => state.log.push(incoming(entry)),
    onError: (entry) => {
      state.log.push(entry)
      state.connected = false
    },
    onClose: () => {
      state.connected = false
    },
  })

  const sseDriver = new BrowserSseDriver()

  const buildUrl = (target: string, query: Record<string, string>) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value !== '') params.append(key, value)
    })
    const search = params.toString()
    if (!search) return target
    return target + (target.includes('?') ? '&' : '?') + search
  }

  const onDisconnect = () => {
    wsDriver.close()
    sseDriver.close()
    state.connected = false
  }

  const validateFields = () => {
    if (fieldsRef.value?.validate()) return true
    message.error(t('common.notEmpty'))
    return false
  }

  const onConnect = () => {
    if (state.connected) {
      onDisconnect()
      return
    }
    if (!debug.value?.debuggable || !validateFields()) return
    const url = buildUrl(state.model.target, state.model.query)
    try {
      if (isWebSocket.value) {
        wsDriver.connect(url)
      } else {
        sseDriver.connect(
          url,
          state.model.headers,
          (entry) => state.log.push(incoming(entry)),
          (entry) => state.log.push(entry),
          () => {
            state.connected = false
          },
          () => {
            state.connected = true
          },
        )
      }
    } catch (error) {
      state.log.push(createLogEntry('in', 'text', (error as Error).message))
    }
  }

  const onSend = () => {
    if (!validateFields()) return
    try {
      wsDriver.send(state.message, state.model.encoding)
    } catch (error) {
      state.log.push(createLogEntry('out', 'text', (error as Error).message))
    }
  }

  // ---------- 中继调试 ----------
  const POLL_DELAY = 300
  let sendSeq = 0
  let streamSeq = 0
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let renewing = false
  let streamInput: ProtocolDebugModel | null = null

  const errorText = (error: unknown) => {
    const err = error as {
      response?: { data?: { message?: string } }
      data?: { message?: string }
      message?: string
    }
    return err?.response?.data?.message || err?.data?.message || err?.message || String(error)
  }

  const errorEntry = (error: string) => createLogEntry('in', 'text', error || 'request failed')

  const appendResult = (result: ApiDebugResult) => {
    if (result.ok) {
      state.log.push({
        ...createLogEntry('in', result.encoding ?? 'text', result.body ?? ''),
        status: result.status,
        meta: result.meta,
      })
      return
    }
    state.log.push(errorEntry(result.error ?? ''))
  }

  const onSendRelay = () => {
    if (relayDisabled.value || state.sending || !validateFields()) return
    const seq = ++sendSeq
    state.sending = true
    sendRelay(props.detail, { ...state.model })
      .then((result) => {
        if (seq === sendSeq) appendResult(result)
      })
      .catch((error) => {
        if (seq === sendSeq) state.log.push(errorEntry(errorText(error)))
      })
      .finally(() => {
        if (seq === sendSeq) state.sending = false
      })
  }

  const clearPoll = () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  const endStream = async (notify = true) => {
    clearPoll()
    const sessionId = state.sessionId
    state.sessionId = ''
    state.streaming = false
    renewing = false
    streamInput = null
    streamSeq++
    if (notify && sessionId) {
      try {
        await stopStream(sessionId)
      } catch (error) {
        // 会话到期后服务端自行回收,关闭失败无需提示
      }
    }
  }

  const appendMessages = (messages: RelayStreamMessage[]) => {
    for (const item of messages) {
      const entry = createLogEntry('in', item.encoding ?? 'text', item.body ?? '')
      state.log.push({ ...entry, time: item.time || entry.time, type: item.type })
    }
  }

  const schedulePoll = (seq: number) => {
    clearPoll()
    pollTimer = setTimeout(() => {
      void pollOnce(seq)
    }, POLL_DELAY)
  }

  const pollOnce = async (seq: number) => {
    if (seq !== streamSeq || !state.sessionId) return
    const sessionId = state.sessionId
    try {
      const result = await pollStream(sessionId)
      if (seq !== streamSeq) return
      if (result.ok === false) {
        const expired = /session not found or expired/i.test(result.error ?? '')
        if (expired && !renewing && streamInput) {
          // 会话 60s 到期后自动续期一次
          await startSession(streamInput, true)
          return
        }
        state.log.push(errorEntry(result.error ?? ''))
        await endStream()
        return
      }
      renewing = false
      appendMessages(result.messages ?? [])
      schedulePoll(seq)
    } catch (error) {
      if (seq !== streamSeq) return
      state.log.push(errorEntry(errorText(error)))
      await endStream()
    }
  }

  const startSession = async (input: ProtocolDebugModel, renew: boolean) => {
    const seq = ++streamSeq
    clearPoll()
    streamInput = input
    renewing = renew
    state.sending = true
    try {
      const result: RelayStartResult = await startStream(props.detail, input)
      if (seq !== streamSeq) {
        // detail 已切换或已手动停止,回收刚建立的会话
        if (result.sessionId) stopStream(result.sessionId).catch(() => {})
        return
      }
      if (!result.sessionId) {
        state.log.push(errorEntry(result.error ?? ''))
        state.streaming = false
        streamInput = null
        renewing = false
        return
      }
      state.sessionId = result.sessionId
      state.streaming = true
      schedulePoll(seq)
    } catch (error) {
      if (seq !== streamSeq) return
      state.log.push(errorEntry(errorText(error)))
      state.streaming = false
      streamInput = null
      renewing = false
    } finally {
      if (seq === streamSeq) state.sending = false
    }
  }

  const onStartStream = () => {
    if (relayDisabled.value || state.sending || !validateFields()) return
    void startSession({ ...state.model }, false)
  }

  const onStopStream = () => {
    void endStream()
  }

  watch(
    () => props.detail,
    () => {
      onDisconnect()
      sendSeq++
      void endStream()
      state.log = []
      state.message = ''
      state.sending = false
    },
  )

  onBeforeUnmount(() => {
    onDisconnect()
    sendSeq++
    void endStream()
  })
</script>

<style lang="less" scoped>
  .protocol-debug-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .protocol-debug-target {
    font-size: 12px;
    color: @text-color-secondary;
    word-break: break-all;
  }
  .protocol-debug-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
  }
  .protocol-debug-status {
    font-size: 12px;
    color: @text-color-secondary;
  }
  .protocol-debug-message {
    margin-top: 10px;
  }
  .protocol-debug-relay {
    margin-top: 12px;
  }
</style>
