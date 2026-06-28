export type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5

export type YouTubePlayerEvent = {
  target: YouTubePlayer
  data: YouTubePlayerState
}

export type YouTubePlayer = {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  destroy(): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  setVolume(volume: number): void
  getVideoData(): { title?: string }
  seekTo(seconds: number, allowSeekAhead: boolean): void
}

export type YouTubeIframeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: YouTubePlayerEvent) => void
        onError?: (event: { target: YouTubePlayer; data: number }) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: {
    UNSTARTED: -1
    ENDED: 0
    PLAYING: 1
    PAUSED: 2
    BUFFERING: 3
    CUED: 5
  }
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeIframeApi> | null = null

export function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)

  apiPromise ??= new Promise<YouTubeIframeApi>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()

      if (window.YT?.Player) {
        resolve(window.YT)
        return
      }

      reject(new Error('YouTube IFrame API did not initialize.'))
    }

    const existingScript = document.getElementById('youtube-iframe-api')

    if (existingScript) return

    const script = document.createElement('script')
    script.id = 'youtube-iframe-api'
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('Unable to load YouTube IFrame API.'))
    document.head.appendChild(script)
  })

  return apiPromise
}
