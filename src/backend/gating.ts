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

export const debugModeEnabled = (
  capabilities: Capabilities | undefined,
  mode: DebugMode | string | undefined,
): boolean => {
  if (!capabilities || !mode) return true
  return capabilities.features.debug.modes.includes(mode as DebugMode)
}
