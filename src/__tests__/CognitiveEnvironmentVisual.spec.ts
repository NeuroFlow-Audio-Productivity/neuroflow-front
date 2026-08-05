import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'

import CognitiveEnvironmentVisual from '@/components/audios/CognitiveEnvironmentVisual.vue'
import { FALLBACK_MODE_COLOR } from '@/services/modeVisuals'

const mountVisual = (
  props: {
    color?: string
    seed?: string | number
    selected?: boolean
    className?: string
    variant?: 'preview' | 'thumbnail'
  } = {},
) =>
  mount(CognitiveEnvironmentVisual, {
    props: {
      color: '#22c55e',
      seed: 'forest-focus',
      selected: false,
      ...props,
    },
  })

describe('CognitiveEnvironmentVisual', () => {
  it('uses the preview variant by default and supports the compact thumbnail variant', () => {
    const preview = mountVisual()
    const thumbnail = mountVisual({ variant: 'thumbnail' })

    expect(preview.classes()).toContain('cognitive-environment-visual--preview')
    expect(thumbnail.classes()).toContain('cognitive-environment-visual--thumbnail')
    expect(thumbnail.classes()).not.toContain('cognitive-environment-visual--preview')
  })

  it('normalizes the mode color and exposes the selected state', () => {
    const wrapper = mountVisual({ color: '#A7F3D0', selected: true, className: 'preview-core' })

    expect(wrapper.attributes('data-environment-color')).toBe('#a7f3d0')
    expect(wrapper.classes()).toContain('cognitive-environment-visual--selected')
    expect(wrapper.classes()).toContain('preview-core')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('uses the shared fallback for an invalid mode color', () => {
    const wrapper = mountVisual({ color: 'not-a-color' })

    expect(wrapper.attributes('data-environment-color')).toBe(FALLBACK_MODE_COLOR)
  })

  it('updates color reactively without replacing the component root', async () => {
    const wrapper = mountVisual()
    const rootElement = wrapper.element

    await wrapper.setProps({ color: '#8b5cf6' })

    expect(wrapper.element).toBe(rootElement)
    expect(wrapper.attributes('data-environment-color')).toBe('#8b5cf6')
  })

  it('creates deterministic visual variations from the seed', () => {
    const first = mountVisual({ seed: 'same-audio' })
    const second = mountVisual({ seed: 'same-audio' })
    const other = mountVisual({ seed: 'another-audio' })

    expect(first.attributes('data-visual-seed')).toBe(second.attributes('data-visual-seed'))
    expect(first.attributes('data-visual-seed')).not.toBe(other.attributes('data-visual-seed'))
  })
})
