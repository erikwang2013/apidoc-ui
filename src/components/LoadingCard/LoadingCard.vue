<template>
  <div class="loading-card">
    <img src="../../assets/images/apidoc-pet.svg" alt="ApiDoc" />
    <a-spin tip="Loading..." />
  </div>
</template>

<script lang="ts" setup></script>
<style lang="less" scoped>
  .loading-card {
    padding: 120px 200px 200px;
    text-align: center;
    & > img {
      display: block;
      width: 120px;
      margin: 0 auto 24px;
    }
    .ant-spin {
      display: inline-block;
    }
  }
</style>
