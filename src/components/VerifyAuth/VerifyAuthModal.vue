<template>
  <a-modal
    :visible="state.visible"
    :width="500"
    :maskClosable="false"
    :title="t('auth.title')"
    destroyOnClose
    @cancel="onCancel"
  >
    <div>
      <a-input-password
        ref="inputRef"
        :placeholder="t('auth.input.placeholder')"
        size="large"
        :allowClear="true"
        v-model:value="state.password"
        @keydown.enter="onSubmit"
      />
    </div>
    <template #footer>
      <a-button type="primary" @click="onSubmit">{{ t('common.ok') }}</a-button>
    </template>
  </a-modal>
</template>

<script lang="ts" setup>
  import { useAppStore } from '/@/store'
  import { useI18n } from '/@/hooks/useI18n'
  import { getBackend } from '/@/backend/state'
  import { message } from 'ant-design-vue'
  import md5 from 'js-md5'
  import { VerifyAuthParams } from '/@/api/apidocApi/types'

  const appStore = useAppStore()

  const { t } = useI18n()

  const props = defineProps({
    onSuccess: {
      type: Function,
      default: () => {
        return
      },
    },
    onCancel: {
      type: Function,
      default: () => {
        return
      },
    },
  })

  // const apidocStore = useApidocStore()

  const state = reactive<{
    visible: boolean
    password: string
  }>({
    visible: false,
    password: '',
  })

  onMounted(() => {
    state.visible = true
  })

  const onSubmit = () => {
    if (!state.password) {
      message.error(t('auth.input.placeholder'))
      return
    }
    const backend = getBackend()
    const password = backend.authHashesPassword ? md5(state.password) : state.password
    let json: VerifyAuthParams = {
      appKey: appStore.appKey,
      password,
    }
    if (appStore.shareKey) {
      json.shareKey = appStore.shareKey as string
    }
    backend
      .verifyAuth(json)
      .then((res) => {
        if (!res || !res.token) {
          message.error(t('auth.input.placeholder'))
          return false
        }
        const key = appStore.shareKey ? 'shareKey_' + appStore.shareKey : appStore.appKey
        appStore.setAppAuth(key, res.token)
        props.onSuccess && props.onSuccess()
        state.visible = false
      })
      .catch((err) => {
        let msg = err.message
        if (err.response && err.response.data && err.response.data.message) {
          msg = err.response.data.message
        }
        message.error(msg)
      })
  }
  const onCancel = () => {
    props.onCancel && props.onCancel()
    state.visible = false
  }
</script>
