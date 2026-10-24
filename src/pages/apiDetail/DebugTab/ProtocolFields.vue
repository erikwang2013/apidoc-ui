<template>
  <a-form class="protocol-fields" layout="vertical" size="small">
    <a-form-item
      v-if="targetView"
      :label="t('apiPage.debug.protocolTarget')"
      :required="targetView.require"
      :validate-status="targetStatus"
    >
      <a-input :value="state.values[targetView.key]" disabled />
    </a-form-item>
    <template v-for="group in groups" :key="group.key">
      <template v-if="group.fields.length">
        <a-divider orientation="left" class="protocol-fields-divider">
          {{ group.key === 'meta' ? 'Meta' : t(`apiPage.debug.${group.key}`) }}
        </a-divider>
        <a-form-item
          v-for="field in group.fields"
          :key="field.key"
          :label="field.name"
          :required="field.require"
          :validate-status="statusOf(field)"
          :help="field.desc"
        >
          <a-switch v-if="field.type === 'boolean'" v-model:checked="state.values[field.key]" />
          <a-input-number
            v-else-if="field.type === 'number'"
            v-model:value="state.values[field.key]"
            style="width: 100%"
          />
          <a-select
            v-else-if="field.options.length"
            v-model:value="state.values[field.key]"
            :options="field.options"
          />
          <a-textarea
            v-else-if="field.textarea"
            v-model:value="state.values[field.key]"
            :rows="4"
          />
          <a-input v-else v-model:value="state.values[field.key]" />
        </a-form-item>
      </template>
    </template>
    <a-form-item v-if="hasPayload" :label="t('apiPage.debug.protocolEncoding')">
      <a-select v-model:value="state.encoding" :options="encodingOptions" />
    </a-form-item>
    <a-form-item label="Timeout">
      <a-input-number v-model:value="state.timeout" :min="1" style="width: 100%" />
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
  import { useI18n } from '/@/hooks/useI18n'
  import { ApiDebugField, ApiDetailResult } from '/@/api/apidocApi/types'
  import { DebugEncoding, ProtocolDebugModel } from './drivers/types'

  const props = withDefaults(defineProps<{ detail: ApiDetailResult }>(), {})
  const emit = defineEmits<{ 'update:modelValue': [ProtocolDebugModel] }>()
  const { t } = useI18n()

  interface FieldOption {
    label: string
    value: string | number
  }
  interface FieldView {
    key: string
    name: string
    type: string
    require: boolean
    desc?: string
    textarea: boolean
    options: FieldOption[]
  }

  const debug = computed(() => props.detail.debug)
  const fields = computed(() => debug.value?.fields ?? [])
  const encodingOptions = ['text', 'json', 'hex', 'base64'].map((value) => ({
    label: value,
    value,
  }))

  const state = reactive({
    values: {} as Record<string, any>,
    encoding: 'text' as DebugEncoding,
    timeout: 5,
    showErrors: false,
  })

  const toView = (field: ApiDebugField): FieldView => {
    const type = typeof field.type === 'string' ? field.type : 'string'
    const rawOptions = Array.isArray(field.enum) ? field.enum : field.options
    return {
      key: `${field.in ?? 'meta'}|${field.name}`,
      name: field.name,
      type,
      require: field.require === true,
      desc: typeof field.desc === 'string' ? field.desc : undefined,
      textarea:
        type === 'array' || type === 'object' || (field.in === 'body' && field.name === 'payload'),
      options: Array.isArray(rawOptions)
        ? rawOptions.map((option) => {
            if (typeof option === 'object' && option !== null) {
              const item = option as Record<string, unknown>
              return {
                label: String(item.label ?? item.value ?? ''),
                value: (item.value ?? item.label ?? '') as string | number,
              }
            }
            return { label: String(option), value: option as string | number }
          })
        : [],
    }
  }

  const groups = computed(() =>
    ['header', 'query', 'body', 'meta'].map((key) => ({
      key,
      fields: fields.value
        .filter((field) => (field.in ?? 'meta') === key)
        .map((field) => toView(field)),
    })),
  )

  const targetView = computed<FieldView | null>(() => {
    const field = fields.value.find((item) => item.in === 'target')
    if (field) return toView(field)
    return debug.value?.defaults?.target
      ? {
          key: 'target|target',
          name: 'target',
          type: 'string',
          require: false,
          textarea: false,
          options: [],
        }
      : null
  })

  const hasPayload = computed(
    () =>
      debug.value?.mode === 'browser-websocket' ||
      fields.value.some((field) => field.in === 'body'),
  )

  const isEmpty = (value: unknown) => value === undefined || value === null || value === ''

  const missing = computed(() =>
    fields.value
      .map((field) => toView(field))
      .filter((field) => field.require && isEmpty(state.values[field.key]))
      .map((field) => field.key),
  )

  const statusOf = (field: FieldView) =>
    state.showErrors && missing.value.includes(field.key) ? 'error' : undefined

  const targetStatus = computed(() => (targetView.value ? statusOf(targetView.value) : undefined))

  const normalise = (field: ApiDebugField, raw: unknown) => {
    const type = typeof field.type === 'string' ? field.type : 'string'
    if (type === 'boolean') {
      return raw === true || raw === 'true'
    }
    if (type === 'number') {
      const value = Number(raw)
      return raw === undefined || raw === null || raw === '' || Number.isNaN(value)
        ? undefined
        : value
    }
    if (type === 'array' || type === 'object') {
      if (raw === undefined || raw === null) return ''
      return typeof raw === 'string' ? raw : JSON.stringify(raw)
    }
    return raw === undefined || raw === null ? '' : String(raw)
  }

  const convert = (field: FieldView, value: unknown) => {
    if (field.type === 'number') {
      return value === undefined || value === null || value === '' ? undefined : Number(value)
    }
    if (field.type === 'boolean') {
      return value === true
    }
    if (field.type === 'array' || field.type === 'object') {
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch (error) {
        return value
      }
    }
    return value === undefined || value === null ? '' : value
  }

  const buildModel = (): ProtocolDebugModel => {
    const headers: Record<string, string> = {}
    const query: Record<string, string> = {}
    const fieldValues: Record<string, unknown> = {}
    let payload = ''
    for (const group of groups.value) {
      for (const field of group.fields) {
        const value = state.values[field.key]
        if (group.key === 'header') {
          headers[field.name] = value === undefined || value === null ? '' : String(value)
        } else if (group.key === 'query') {
          query[field.name] = value === undefined || value === null ? '' : String(value)
        } else if (group.key === 'body' && field.name === 'payload') {
          payload = value === undefined || value === null ? '' : String(value)
        } else {
          fieldValues[field.name] = convert(field, value)
        }
      }
    }
    return {
      target: String(state.values['target|target'] ?? debug.value?.defaults?.target ?? ''),
      headers,
      query,
      fields: fieldValues,
      payload,
      encoding: state.encoding,
      timeout: state.timeout,
    }
  }

  const emitModel = () => {
    emit('update:modelValue', buildModel())
  }

  const init = () => {
    const values: Record<string, unknown> = {}
    const defaults = (debug.value?.defaults ?? {}) as Record<string, unknown>
    for (const field of fields.value) {
      const fallback = field.default !== undefined ? field.default : defaults[field.name]
      values[`${field.in ?? 'meta'}|${field.name}`] = normalise(field, fallback)
    }
    if (!('target|target' in values)) {
      values['target|target'] = defaults.target === undefined ? '' : String(defaults.target)
    }
    state.values = values
    state.encoding = (defaults.encoding as DebugEncoding) || 'text'
    state.timeout = Number(defaults.timeout) || 5
    state.showErrors = false
    emitModel()
  }

  const validate = () => {
    state.showErrors = true
    return missing.value.length === 0
  }

  watch(state, emitModel, { deep: true })
  watch(() => props.detail, init)
  init()

  defineExpose({ validate })
</script>
