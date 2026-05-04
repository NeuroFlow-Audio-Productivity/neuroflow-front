import { beforeAll, describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import { i18n } from '../i18n'
import HomeView from '../views/HomeView.vue'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext']
  global.ResizeObserver = class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
})

describe('HomeView', () => {
  it('mounts renders properly', () => {
    i18n.global.locale.value = 'pt-BR'

    const wrapper = mount(HomeView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('NeuroFlow')
    expect(wrapper.text()).toContain('Foco profundo')
  })
})
