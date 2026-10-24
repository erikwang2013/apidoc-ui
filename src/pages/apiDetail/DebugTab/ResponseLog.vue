<template>
  <div class="response-log">
    <div class="response-log-title">
      {{ t('apiPage.debug.protocolMessages') }}
      <span class="response-log-count">{{ props.entries.length }}</span>
    </div>
    <a-empty v-if="!props.entries.length" :description="t('common.notdata')" />
    <div v-for="(entry, index) in props.entries" :key="index" class="response-log-item">
      <div class="response-log-meta">
        <span>{{ entry.time }}</span>
        <a-tag :color="entry.direction === 'in' ? 'green' : 'blue'">{{ entry.direction }}</a-tag>
        <span>{{ entry.encoding }}</span>
        <span>{{ byteLength(entry) }} {{ t('apiPage.debug.protocolBytes') }}</span>
      </div>
      <pre class="response-log-body">{{ formatBody(entry) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from '/@/hooks/useI18n'
  import { DebugLogEntry } from './drivers/types'

  const props = withDefaults(defineProps<{ entries: DebugLogEntry[] }>(), {})
  const { t } = useI18n()

  const formatBody = (entry: DebugLogEntry) => {
    if (entry.encoding === 'hex') {
      return entry.body.toUpperCase()
    }
    if (entry.encoding === 'json') {
      try {
        return JSON.stringify(JSON.parse(entry.body), null, 2)
      } catch (error) {
        return entry.body
      }
    }
    return entry.body
  }

  const byteLength = (entry: DebugLogEntry) => {
    if (entry.encoding === 'hex') {
      return Math.floor(entry.body.replace(/\s+/g, '').length / 2)
    }
    if (entry.encoding === 'base64') {
      return Math.floor((entry.body.length * 3) / 4)
    }
    return new TextEncoder().encode(entry.body).length
  }
</script>

<style lang="less" scoped>
  .response-log {
    margin-top: 12px;
  }
  .response-log-title {
    margin-bottom: 8px;
    font-weight: 500;
  }
  .response-log-count {
    margin-left: 6px;
    color: @text-color-secondary;
  }
  .response-log-item {
    padding: 6px 0;
    border-top: 1px solid @border-color-split;
  }
  .response-log-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: @text-color-secondary;
  }
  .response-log-body {
    max-height: 240px;
    margin: 6px 0 0;
    padding: 8px;
    overflow: auto;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
    background: @background-color-light;
  }
</style>
