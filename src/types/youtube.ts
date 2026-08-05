export type YouTubeTrack = {
  provider: 'youtube'
  videoId: string
  url: string
  title: string
  addedAt: number
}

export type SessionAudioSource =
  | { provider: 'uploaded'; audioId: string | number | null }
  | { provider: 'youtube'; videoId: string }

export type YouTubeLibrary = {
  version: 1
  tracks: YouTubeTrack[]
  selectedVideoId: string | null
}
