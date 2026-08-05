import type { YouTubeLibrary, YouTubeTrack } from '@/types/youtube'

export type ParsedYouTubeUrl = {
  videoId: string
  url: string
}

export const MAX_YOUTUBE_TRACKS = 10
export const YOUTUBE_LIBRARY_VERSION = 1

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

export function canonicalYouTubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function defaultYouTubeTitle(videoId: string) {
  return `YouTube · ${videoId}`
}

function isValidVideoId(videoId: string | null | undefined): videoId is string {
  return typeof videoId === 'string' && VIDEO_ID_PATTERN.test(videoId)
}

function firstPathVideoId(pathname: string, segment: string) {
  const parts = pathname.split('/').filter(Boolean)
  const index = parts.indexOf(segment)

  return index >= 0 ? parts[index + 1] : undefined
}

export function parseYouTubeUrl(value: string): ParsedYouTubeUrl | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) return null

  let parsed: URL

  try {
    parsed = new URL(trimmedValue)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null

  const hostname = parsed.hostname.toLowerCase()
  let videoId: string | null | undefined = null

  if (hostname === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0]
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    const pathname = parsed.pathname

    if (pathname === '/watch') {
      videoId = parsed.searchParams.get('v')
    } else {
      videoId =
        firstPathVideoId(pathname, 'shorts') ??
        firstPathVideoId(pathname, 'embed') ??
        firstPathVideoId(pathname, 'live')
    }
  }

  if (!isValidVideoId(videoId)) return null

  return {
    videoId,
    url: canonicalYouTubeUrl(videoId),
  }
}

export function createYouTubeTrack(
  parsedUrl: ParsedYouTubeUrl,
  title = defaultYouTubeTitle(parsedUrl.videoId),
  addedAt = Date.now(),
): YouTubeTrack {
  return {
    provider: 'youtube',
    videoId: parsedUrl.videoId,
    url: parsedUrl.url,
    title: title.trim() || defaultYouTubeTitle(parsedUrl.videoId),
    addedAt,
  }
}

export function youtubeLibraryStorageKey(userId?: string | number | null) {
  return `neuroflow-youtube-audios:${userId ?? 'guest'}`
}

export function emptyYouTubeLibrary(): YouTubeLibrary {
  return {
    version: YOUTUBE_LIBRARY_VERSION,
    tracks: [],
    selectedVideoId: null,
  }
}

function normalizeTrack(value: unknown): YouTubeTrack | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Partial<YouTubeTrack>

  if (!isValidVideoId(record.videoId)) return null

  return {
    provider: 'youtube',
    videoId: record.videoId,
    url: canonicalYouTubeUrl(record.videoId),
    title:
      typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : defaultYouTubeTitle(record.videoId),
    addedAt: typeof record.addedAt === 'number' ? record.addedAt : Date.now(),
  }
}

export function parseYouTubeLibrary(value: unknown): YouTubeLibrary {
  if (!value || typeof value !== 'object') return emptyYouTubeLibrary()

  const record = value as { tracks?: unknown; selectedVideoId?: unknown }
  const seen = new Set<string>()
  const tracks = Array.isArray(record.tracks)
    ? record.tracks
        .map(normalizeTrack)
        .filter((track): track is YouTubeTrack => Boolean(track))
        .filter((track) => {
          if (seen.has(track.videoId)) return false
          seen.add(track.videoId)

          return true
        })
        .sort((first, second) => second.addedAt - first.addedAt)
        .slice(0, MAX_YOUTUBE_TRACKS)
    : []

  const selectedVideoId =
    isValidVideoId(String(record.selectedVideoId)) &&
    tracks.some((track) => track.videoId === record.selectedVideoId)
      ? String(record.selectedVideoId)
      : null

  return {
    version: YOUTUBE_LIBRARY_VERSION,
    tracks,
    selectedVideoId,
  }
}

export function loadYouTubeLibrary(storage: Storage | null, key: string) {
  if (!storage) return emptyYouTubeLibrary()

  try {
    const rawValue = storage.getItem(key)

    if (!rawValue) return emptyYouTubeLibrary()

    return parseYouTubeLibrary(JSON.parse(rawValue))
  } catch {
    return emptyYouTubeLibrary()
  }
}

export function saveYouTubeLibrary(storage: Storage | null, key: string, library: YouTubeLibrary) {
  if (!storage) return

  try {
    storage.setItem(key, JSON.stringify(parseYouTubeLibrary(library)))
  } catch {
    // Local persistence should never block the timer.
  }
}

export function upsertYouTubeTrack(
  library: YouTubeLibrary,
  track: YouTubeTrack,
  selectTrack = true,
): YouTubeLibrary {
  const nextTrack = { ...track, addedAt: Date.now() }
  const tracks = [
    nextTrack,
    ...library.tracks.filter((storedTrack) => storedTrack.videoId !== nextTrack.videoId),
  ].slice(0, MAX_YOUTUBE_TRACKS)

  return {
    version: YOUTUBE_LIBRARY_VERSION,
    tracks,
    selectedVideoId: selectTrack ? nextTrack.videoId : library.selectedVideoId,
  }
}

export function removeYouTubeTrack(library: YouTubeLibrary, videoId: string): YouTubeLibrary {
  const tracks = library.tracks.filter((track) => track.videoId !== videoId)

  return {
    version: YOUTUBE_LIBRARY_VERSION,
    tracks,
    selectedVideoId: library.selectedVideoId === videoId ? null : library.selectedVideoId,
  }
}

export function selectYouTubeTrack(
  library: YouTubeLibrary,
  videoId: string | null,
): YouTubeLibrary {
  return {
    version: YOUTUBE_LIBRARY_VERSION,
    tracks: library.tracks,
    selectedVideoId:
      videoId && library.tracks.some((track) => track.videoId === videoId) ? videoId : null,
  }
}
