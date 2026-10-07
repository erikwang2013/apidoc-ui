export interface CreateStorageParams {
  prefixKey: string
  storage: Storage
}

export const createStorage = ({
  prefixKey = '',
  storage = localStorage,
}: CreateStorageParams): any => {
  const WebStorage = class WebStorage {
    private prefixKey?: string
    private storage: Storage

    constructor() {
      this.prefixKey = prefixKey
      this.storage = storage
    }
    private getKey(key: string) {
      return `${this.prefixKey}${key}`.toUpperCase()
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    set(key: string, value: any): void {
      this.storage.setItem(this.getKey(key), JSON.stringify(value))
    }
    get(key: string, def: any = null): any {
      const val = this.storage.getItem(this.getKey(key))
      if (!val) return def

      try {
        const data = JSON.parse(val)
        // 兼容旧格式（曾是 {value,time,expire} 包装），可在一个版本后删除
        if (data && typeof data === 'object' && 'value' in data && 'time' in data) {
          return data.value
        }
        return data
      } catch (e) {
        return def
      }
    }
    remove(key: string): void {
      this.storage.removeItem(this.getKey(key))
    }
  }
  return new WebStorage()
}
