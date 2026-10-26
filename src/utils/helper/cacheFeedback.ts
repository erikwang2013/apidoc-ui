/**
 * 缓存操作的提示样式：构建期后端不真正清理/预热，只返回 mode:"build"，
 * 用 info 如实提示，不能显示成功。
 */
export function cacheFeedback(
  res: { mode?: string; message?: string } | null | undefined,
  fallback: string,
  buildFallback: string,
): { level: 'info' | 'success'; text: string } {
  if (res && res.mode === 'build') {
    return { level: 'info', text: res.message || buildFallback }
  }
  return { level: 'success', text: (res && res.message) || fallback }
}
