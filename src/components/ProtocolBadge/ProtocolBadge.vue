<template>
  <span class="protocol-badge">{{ label }}</span>
</template>

<script lang="ts" setup>
  import { ApiProtocolInfo } from '/@/api/apidocApi/types'

  interface Props {
    protocol?: ApiProtocolInfo
    protocolKey?: string
    protocolLabel?: string
  }
  const props = withDefaults(defineProps<Props>(), {})

  const label = computed(
    () => props.protocol?.label || props.protocolLabel || (props.protocolKey || '').toUpperCase(),
  )
</script>
<style lang="less" scoped>
  .protocol-badge {
    display: inline-block;
    min-width: 44px;
    margin-right: 4px;
    padding: 0 4px;
    font-size: 12px;
    line-height: 18px;
    color: @primary-color;
    text-align: center;
    white-space: nowrap;
    border: 1px solid currentColor;
    border-radius: 2px;
    box-sizing: border-box;
  }
</style>
