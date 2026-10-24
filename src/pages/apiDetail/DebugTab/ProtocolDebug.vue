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
      <a-alert type="info" message="Relay panel (Task 12)" />
      <a-button type="primary" disabled>{{ t('apiPage.debug.protocolSend') }}</a-button>
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
  import { ApiDetailResult } from '/@/api/apidocApi/types'
  import { useI18n } from '/@/hooks/useI18n'
  import ProtocolFields from './ProtocolFields.vue'
  import ResponseLog from './ResponseLog.vue'
  import { BrowserWebSocketDriver } from './drivers/browserWebSocket'
  import { BrowserSseDriver } from './drivers/browserSse'
  import { createLogEntry, DebugLogEntry, ProtocolDebugModel } from './drivers/types'

  const props = withDefaults(defineProps<{ detail: ApiDetailResult }>(), {})
  const { t } = useI18n()

  const debug = computed(() => props.detail.debug)
  const isRelay = computed(() => (debug.value?.mode ?? '').startsWith('relay-'))
  const isWebSocket = computed(() => debug.value?.mode === 'browser-websocket')

  const fieldsRef = ref()

  const state = reactive<{
    model: ProtocolDebugModel
    message: string
    log: DebugLogEntry[]
    connected: boolean
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
  })

  const wsDriver = new BrowserWebSocketDriver({
    onOpen: () => {
      state.connected = true
    },
    onMessage: (entry) => state.log.push(entry),
    onError: (entry) => {
      state.log.push(entry)
      state.connected = false
    },
    onClose: () => {
      state.connected = false
    },
  })

  const sseDriver = new BrowserSseDriver({
    onOpen: () => {
      state.connected = true
    },
    onMessage: (entry) => state.log.push(entry),
    onError: (entry) => state.log.push(entry),
    onClose: () => {
      state.connected = false
    },
  })

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
        sseDriver.connect(url)
      }
    } catch (error) {
      state.log.push(createLogEntry('in', 'text', (error as Error).message))
    }
  }

  const onSend = () => {
    if (!validateFields()) return
    wsDriver.send(state.message, state.model.encoding)
  }

  watch(
    () => props.detail,
    () => {
      onDisconnect()
      state.log = []
      state.message = ''
    },
  )

  onBeforeUnmount(onDisconnect)
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
  .protocol-debug-relay button {
    margin-top: 10px;
  }
</style>
