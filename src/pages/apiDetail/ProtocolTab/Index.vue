<template>
  <div class="api-protocol">
    <a-empty
      v-if="!props.detail.definitions || !props.detail.definitions.length"
      :description="t('apiPage.protocol.noDefinitions')"
    />
    <template v-else>
      <a-card
        v-for="(def, index) in props.detail.definitions"
        :key="index"
        size="small"
        class="protocol-card"
      >
        <template #title>{{ def.format }} · {{ def.source }}</template>
        <a-descriptions size="small" :column="1" bordered>
          <a-descriptions-item :label="t('apiPage.protocol.format')">{{
            def.format
          }}</a-descriptions-item>
          <a-descriptions-item :label="t('apiPage.protocol.source')">{{
            def.source
          }}</a-descriptions-item>
          <a-descriptions-item v-if="def.operation" :label="t('apiPage.protocol.operation')">{{
            def.operation
          }}</a-descriptions-item>
          <a-descriptions-item
            v-for="(value, key) in def.meta || {}"
            :key="String(key)"
            :label="String(key)"
            >{{ String(value) }}</a-descriptions-item
          >
        </a-descriptions>
        <a-alert
          v-if="!def.validation.ok"
          type="error"
          class="protocol-alert"
          :message="t('apiPage.protocol.validation')"
        >
          <div v-for="(err, i) in def.validation.errors" :key="i">
            {{ err.line ? `${err.line}:${err.column || 0} ` : '' }}{{ err.message }}
          </div>
        </a-alert>
        <a-tabs v-if="def.messages && def.messages.length" class="protocol-alert">
          <a-tab-pane
            v-for="direction in directions(def)"
            :key="direction"
            :tab="t('apiPage.protocol.' + direction)"
          >
            <div
              v-for="msg in messagesByDirection(def, direction)"
              :key="msg.name"
              class="protocol-message"
            >
              <h4>{{ msg.name }}</h4>
              <table-card :title="msg.name" :columns="columns" :data="msg.fields" />
              <a-alert
                v-if="msg.sampleValidation && !msg.sampleValidation.ok"
                type="error"
                class="protocol-alert"
                :message="t('apiPage.protocol.validation')"
              >
                <div v-for="(err, i) in msg.sampleValidation.errors" :key="i">
                  {{ err.message }}
                </div>
              </a-alert>
            </div>
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import { ApiDefinitionInfo, ApiDetailResult, ApiMessageInfo } from '/@/api/apidocApi/types'
  import { useI18n } from '/@/hooks/useI18n'
  import TableCard from '../tableTab/TableCard.vue'

  const { t } = useI18n()
  const props = withDefaults(
    defineProps<{
      detail: ApiDetailResult
    }>(),
    {},
  )

  const columns = [
    { title: t('apiPage.common.field'), dataIndex: 'name', width: 280 },
    { title: t('apiPage.common.method'), dataIndex: 'type', align: 'center', width: 130 },
    { title: t('apiPage.common.require'), dataIndex: 'require', width: 100, align: 'center' },
    { title: t('apiPage.common.desc'), dataIndex: 'desc' },
  ]

  const directions = (def: ApiDefinitionInfo) =>
    Array.from(new Set((def.messages || []).map((msg) => msg.direction)))
  const messagesByDirection = (def: ApiDefinitionInfo, direction: string): ApiMessageInfo[] =>
    (def.messages || []).filter((msg) => msg.direction === direction)
</script>

<style lang="less" scoped>
  .protocol-card + .protocol-card {
    margin-top: 16px;
  }
  .protocol-alert {
    margin-top: 12px;
  }
  .protocol-message + .protocol-message {
    margin-top: 16px;
  }
</style>
