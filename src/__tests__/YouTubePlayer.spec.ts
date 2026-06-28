import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import YouTubePlayer from '@/components/audios/YouTubePlayer.vue'
import type { YouTubePlayerState } from '@/services/youtubeIframeApi'

type PlayerOptions = ConstructorParameters<NonNullable<typeof window.YT>['Player']>[1]

let latestOptions: PlayerOptions | null = null
const player = {
  playVideo: vi.fn<() => void>(),
  pauseVideo: vi.fn<() => void>(),
  stopVideo: vi.fn<() => void>(),
  destroy: vi.fn<() => void>(),
  mute: vi.fn<() => void>(),
  unMute: vi.fn<() => void>(),
  isMuted: vi.fn<() => boolean>(() => false),
  setVolume: vi.fn<(volume: number) => void>(),
  getVideoData: vi.fn<() => { title: string }>(() => ({ title: 'Mocked title' })),
  seekTo: vi.fn<(seconds: number, allowSeekAhead: boolean) => void>(),
}

function installMockApi() {
  window.YT = {
    Player: vi.fn<(element: HTMLElement, options: PlayerOptions) => typeof player>(function (
      this: Record<string, unknown>,
      _element: HTMLElement,
      options: PlayerOptions,
    ) {
      latestOptions = options
      Object.assign(this, player)
      queueMicrotask(() => options.events?.onReady?.({ target: player }))

      return player
    }) as unknown as NonNullable<typeof window.YT>['Player'],
    PlayerState: {
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  }
}

describe('YouTubePlayer', () => {
  beforeEach(() => {
    latestOptions = null
    Object.values(player).forEach((mock) => {
      if (typeof mock === 'function' && 'mockClear' in mock) mock.mockClear()
    })
    installMockApi()
  })

  afterEach(() => {
    delete window.YT
    delete window.onYouTubeIframeAPIReady
  })

  it('initializes the official iframe player with a visible looping video', async () => {
    const wrapper = mount(YouTubePlayer, {
      props: {
        videoId: 'dQw4w9WgXcQ',
        playing: false,
        volume: 0.42,
      },
    })

    await vi.waitFor(() => expect(window.YT?.Player).toHaveBeenCalled())
    await vi.waitFor(() => expect(wrapper.emitted('ready')).toBeTruthy())

    expect(latestOptions?.videoId).toBe('dQw4w9WgXcQ')
    expect(latestOptions?.playerVars).toMatchObject({
      controls: 1,
      enablejsapi: 1,
      loop: 1,
      playlist: 'dQw4w9WgXcQ',
      playsinline: 1,
    })
    expect(player.setVolume).toHaveBeenCalledWith(42)
    expect(wrapper.emitted('title')?.[0]).toEqual(['Mocked title'])
  })

  it('syncs play, pause, mute, errors, buffering, looping, and cleanup', async () => {
    const wrapper = mount(YouTubePlayer, {
      props: {
        videoId: 'dQw4w9WgXcQ',
        playing: true,
        muted: false,
      },
    })

    await vi.waitFor(() => expect(wrapper.emitted('ready')).toBeTruthy())
    expect(player.playVideo).toHaveBeenCalled()

    await wrapper.setProps({ playing: false })
    expect(player.pauseVideo).toHaveBeenCalled()

    await wrapper.setProps({ muted: true })
    expect(player.mute).toHaveBeenCalled()

    latestOptions?.events?.onStateChange?.({
      target: player,
      data: 3 as YouTubePlayerState,
    })
    const waitingEvents = wrapper.emitted('waiting') ?? []
    expect(waitingEvents[waitingEvents.length - 1]).toEqual([true])

    await wrapper.setProps({ playing: true })
    latestOptions?.events?.onStateChange?.({
      target: player,
      data: 0 as YouTubePlayerState,
    })
    expect(player.seekTo).toHaveBeenCalledWith(0, true)

    latestOptions?.events?.onError?.({ target: player, data: 101 })
    const errorEvents = wrapper.emitted('error') ?? []
    expect(errorEvents[errorEvents.length - 1]).toEqual([101])

    wrapper.unmount()
    expect(player.destroy).toHaveBeenCalled()
  })
})
