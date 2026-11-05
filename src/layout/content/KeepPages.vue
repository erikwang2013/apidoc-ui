<template>
  <div class="keep-pages">
    <iframe
      v-for="item in appStore.keepPages"
      :key="item.fullPath"
      :src="isHttpUrl(item.query.url) ? item.query.url : 'about:blank'"
      ref="iframe"
      class="iframe"
      :style="{ display: item.fullPath == route.fullPath ? 'block' : 'none' }"
      border="0"
      sandbox="allow-scripts allow-same-origin allow-forms"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
  import { useAppStore } from '/@/store'
  import { useRoute } from 'vue-router'
  import { isHttpUrl } from '/@/utils/helper'
  const appStore = useAppStore()
  const route = useRoute()
</script>

<style lang="less" scoped>
  .iframe {
    height: calc(100vh - 90px);
    width: 100%;
    border: none;
  }
</style>
