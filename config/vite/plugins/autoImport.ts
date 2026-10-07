/**
 * @name AutoImportDeps
 * @description 按需加载，自动引入
 */
import AutoImport from 'unplugin-auto-import/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export const AutoImportDeps = () => {
  return AutoImport({
    dts: 'types/auto-imports.d.ts',
    imports: ['vue', 'pinia', 'vue-router'],
    resolvers: [AntDesignVueResolver({ importStyle: 'less' })],
  })
}
