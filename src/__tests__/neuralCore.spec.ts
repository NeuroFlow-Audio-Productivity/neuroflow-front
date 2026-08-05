import { beforeAll, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import NeuralCore from '@/components/core/NeuralCore.vue'

import {
  normalizeAudioBands,
  normalizeNeuralCoreProgress,
  resolveNeuralCoreMode,
  resolveNeuralCoreMotionScale,
  resolveNeuralCoreSessionState,
  selectNeuralCoreRenderMode,
} from '@/services/neuralCore'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext']
  global.ResizeObserver = class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

describe('Neural Core integration logic', () => {
  it('normalizes timer progress without allowing invalid render values', () => {
    expect(normalizeNeuralCoreProgress(-20)).toBe(0)
    expect(normalizeNeuralCoreProgress(25)).toBe(0.25)
    expect(normalizeNeuralCoreProgress(140)).toBe(1)
    expect(normalizeNeuralCoreProgress(Number.NaN)).toBe(0)
  })

  it('selects cohesive but distinct behavior for each semantic mode', () => {
    const focus = resolveNeuralCoreMode('focus')
    const relax = resolveNeuralCoreMode('relax')
    const sleep = resolveNeuralCoreMode('sleep')

    expect(focus.speed).toBeGreaterThan(relax.speed)
    expect(relax.deformation).toBeGreaterThan(focus.deformation)
    expect(sleep.speed).toBeLessThan(relax.speed)
    expect(sleep.brightness).toBeLessThan(focus.brightness)
    expect(resolveNeuralCoreMode(null)).toEqual(focus)
  })

  it('derives idle, playing, and paused states from existing timer state', () => {
    expect(resolveNeuralCoreSessionState(false, 0)).toBe('idle')
    expect(resolveNeuralCoreSessionState(true, 0)).toBe('playing')
    expect(resolveNeuralCoreSessionState(false, 0.42)).toBe('paused')
    expect(resolveNeuralCoreSessionState(false, 0, true)).toBe('paused')
  })

  it('greatly reduces motion when reduced motion is requested', () => {
    expect(resolveNeuralCoreMotionScale('playing', false)).toBe(1)
    expect(resolveNeuralCoreMotionScale('paused', false)).toBeLessThan(0.25)
    expect(resolveNeuralCoreMotionScale('playing', true)).toBeLessThan(0.05)
  })

  it('selects full, simplified, and static rendering fallbacks', () => {
    expect(
      selectNeuralCoreRenderMode({
        webglAvailable: true,
        reducedMotion: false,
        lowCapability: false,
      }),
    ).toBe('full')
    expect(
      selectNeuralCoreRenderMode({
        webglAvailable: true,
        reducedMotion: true,
        lowCapability: false,
      }),
    ).toBe('minimal')
    expect(
      selectNeuralCoreRenderMode({
        webglAvailable: true,
        reducedMotion: false,
        lowCapability: true,
      }),
    ).toBe('minimal')
    expect(
      selectNeuralCoreRenderMode({
        webglAvailable: false,
        reducedMotion: false,
        lowCapability: false,
      }),
    ).toBe('static')
  })

  it('normalizes unavailable or invalid audio analysis into a safe fallback', () => {
    expect(normalizeAudioBands(null)).toEqual({ low: 0, mid: 0, high: 0 })
    expect(normalizeAudioBands({ low: -1, mid: 0.4, high: 3 })).toEqual({
      low: 0,
      mid: 0.4,
      high: 1,
    })
  })

  it('uses the decorative static fallback and cleans up safely without WebGL', () => {
    const wrapper = mount(NeuralCore, {
      props: {
        progress: 0.36,
        sessionState: 'paused',
        modeKey: 'focus',
        accentColor: '#6ee7d8',
        panelExpanded: false,
      },
    })

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('data-render-mode')).toBe('static')
    expect(wrapper.find('canvas').attributes('tabindex')).toBe('-1')
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
