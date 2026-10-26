import { describe, expect, it } from 'vitest'
import { cacheFeedback } from '../cacheFeedback'

describe('cacheFeedback', () => {
  it('reports build-mode results as info instead of fake success', () => {
    expect(cacheFeedback({ mode: 'build', message: 'build-time' }, 'done', 'build msg')).toEqual({
      level: 'info',
      text: 'build-time',
    })
    expect(cacheFeedback({ mode: 'build' }, 'done', 'build msg')).toEqual({
      level: 'info',
      text: 'build msg',
    })
  })

  it('reports server-mode results as success', () => {
    expect(cacheFeedback({ mode: 'server' }, 'done', 'build msg')).toEqual({
      level: 'success',
      text: 'done',
    })
    expect(cacheFeedback({ mode: 'server', message: 'cleared' }, 'done', 'build msg')).toEqual({
      level: 'success',
      text: 'cleared',
    })
  })
})
