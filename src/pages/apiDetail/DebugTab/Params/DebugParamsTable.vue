<template>
  <EditTable
    :columns="columns"
    :data="props.data"
    :is-add="isQuery"
    @add-row="emit('addRow')"
    @delete-row="(row) => emit('deleteRow', row)"
    @cell-change="(value, column, record) => emit('cellChange', value, column, record)"
    :scroll="
      isQuery
        ? {
            x: '700px',
            y: '170px',
          }
        : {
            x: '500px',
            y: '180px',
          }
    "
  />
</template>

<script setup lang="ts">
  import { useI18n } from '/@/hooks/useI18n'
  import { ApiDetailParamItem } from '/@/api/apidocApi/types'
  import EditTable from '/@/components/EditTable'
  import { ColumnItem } from '/@/components/EditTable/types'

  const { t } = useI18n()
  const props = withDefaults(
    defineProps<{
      type: 'header' | 'route' | 'query'
      data?: ApiDetailParamItem[]
    }>(),
    {},
  )
  const emit = defineEmits<{
    (event: 'addRow'): void
    (event: 'deleteRow', row: any): void
    (event: 'cellChange', value: any, column: ColumnItem, record: any): void
  }>()

  const isQuery = props.type === 'query'

  // query 额外含必填列与操作列，header/route 共用同一套列
  const columns: ColumnItem[] = isQuery
    ? [
        {
          title: t('apiPage.common.field'),
          dataIndex: 'name',
          width: 200,
          align: 'left',
          itemRender: {
            name: 'input',
          },
        },
        {
          title: t('apiPage.common.value'),
          dataIndex: 'default',
          itemRender: {
            name: 'input',
          },
        },
        {
          title: t('apiPage.common.require'),
          dataIndex: 'require',
          width: 100,
          align: 'center',
          itemRender: {
            name: 'check-status',
          },
        },
        {
          title: t('apiPage.common.desc'),
          dataIndex: 'desc',
          width: 150,
          align: 'left',
        },
        {
          title: t('apiPage.common.action'),
          dataIndex: 'id',
          width: 70,
          align: 'center',
          itemRender: {
            name: 'delete-button',
          },
        },
      ]
    : [
        {
          title: t('apiPage.common.field'),
          dataIndex: 'name',
          width: 200,
          align: 'left',
        },
        {
          title: t('apiPage.common.value'),
          dataIndex: 'default',
          itemRender: {
            name: 'input',
          },
        },
        {
          title: t('apiPage.common.desc'),
          dataIndex: 'desc',
          width: 150,
          align: 'left',
        },
      ]
</script>

<style lang="less" scoped></style>
