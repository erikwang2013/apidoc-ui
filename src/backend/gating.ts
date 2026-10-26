import type { Capabilities, DebugMode } from './types'

const readPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, value)

/** Unknown capabilities mean a legacy backend: keep the historical behavior. */
export const featureEnabled = (capabilities: Capabilities | undefined, path: string): boolean => {
  if (!capabilities) return true
  return readPath(capabilities.features, path) === true
}

/** 生成器入口：能力声明 generator.forms 且服务端配置了生成器列表。 */
export const generatorToolsVisible = (
  capabilities: Capabilities | undefined,
  generators: unknown[] | undefined,
): boolean => featureEnabled(capabilities, 'generator.forms') && !!generators?.length

export const debugModeEnabled = (
  capabilities: Capabilities | undefined,
  mode: DebugMode | string | undefined,
): boolean => {
  if (!capabilities || !mode) return true
  return capabilities.features.debug.modes.includes(mode as DebugMode)
}
