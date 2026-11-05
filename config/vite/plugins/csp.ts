/**
 * @name ConfigCspPlugin
 * @description 生成带 nonce 的 CSP：
 * - nonce 在启动/构建时随机生成，写入 index.html 的 script 标签与 meta；
 * - 'strict-dynamic' 允许受信任脚本（config.js、主包）动态加载 LOAD_SCRIPTS；
 * - 'unsafe-eval' 是 better-mock 解析占位符参数的硬性要求，参数已由 safeMock 白名单校验。
 */
import crypto from 'node:crypto'
import type { Plugin } from 'vite'

const CSP_META = /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?>/i

export const ConfigCspPlugin = (): Plugin => {
  return {
    name: 'config-csp',
    enforce: 'post',
    transformIndexHtml(html) {
      const nonce = crypto.randomBytes(16).toString('base64')
      const policy = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: http: https:",
        "font-src 'self' data:",
        "connect-src * ws: wss:",
        "media-src *",
        "frame-src *",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      const withNonce = html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
      return withNonce.replace(
        CSP_META,
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
    },
  }
}
