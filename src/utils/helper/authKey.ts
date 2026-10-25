export const normalizeHost = (host?: string): string => {
  const value = (host || '').replace(/\/+$/, '')
  return value || 'same-origin'
}

/** Tokens are scoped by backend host as well as app/share/global scope. */
export const authKey = (host: string | undefined, scope: string): string =>
  `${normalizeHost(host)}|${scope}`
