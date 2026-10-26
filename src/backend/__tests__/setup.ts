const storage = new Map<string, string>()

const localStorageStub: Storage = {
  get length() {
    return storage.size
  },
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key) => {
    storage.delete(key)
  },
  setItem: (key, value) => {
    storage.set(key, String(value))
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  configurable: true,
})

Object.defineProperty(globalThis, 'apidocFeConfig', {
  value: {
    TITLE: 'apidoc-test',
    HTTP: { HOSTS: [] },
    LANG: [],
  },
  configurable: true,
})
