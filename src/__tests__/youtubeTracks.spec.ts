import { describe, expect, it } from 'vitest'

import {
  createYouTubeTrack,
  loadYouTubeLibrary,
  MAX_YOUTUBE_TRACKS,
  parseYouTubeLibrary,
  parseYouTubeUrl,
  removeYouTubeTrack,
  selectYouTubeTrack,
  upsertYouTubeTrack,
  youtubeLibraryStorageKey,
} from '@/services/youtubeTracks'

const acceptedUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=ignored',
  'https://youtu.be/dQw4w9WgXcQ?t=43',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
]

describe('youtubeTracks', () => {
  it('parses supported individual YouTube URL formats into canonical video links', () => {
    acceptedUrls.forEach((url) => {
      expect(parseYouTubeUrl(url)).toEqual({
        videoId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
    })
  })

  it('rejects playlists, malformed video ids, unsupported hosts, and script-like values', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=PL123')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=too-short')).toBeNull()
    expect(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseYouTubeUrl('javascript:alert(1)')).toBeNull()
  })

  it('scopes storage keys to the user or guest browser profile', () => {
    expect(youtubeLibraryStorageKey(42)).toBe('neuroflow-youtube-audios:42')
    expect(youtubeLibraryStorageKey(null)).toBe('neuroflow-youtube-audios:guest')
  })

  it('deduplicates, keeps newest first, and caps recent links at ten', () => {
    let library = parseYouTubeLibrary({ tracks: [], selectedVideoId: null })

    Array.from({ length: MAX_YOUTUBE_TRACKS + 2 }).forEach((_, index) => {
      const videoId = `${String(index).padStart(10, '0')}A`
      library = upsertYouTubeTrack(
        library,
        createYouTubeTrack({
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        }),
      )
    })

    expect(library.tracks).toHaveLength(MAX_YOUTUBE_TRACKS)
    expect(library.tracks[0]?.videoId).toBe('0000000011A')

    const movedTrack = createYouTubeTrack({
      videoId: '0000000005A',
      url: 'https://www.youtube.com/watch?v=0000000005A',
    })
    library = upsertYouTubeTrack(library, movedTrack)

    expect(library.tracks).toHaveLength(MAX_YOUTUBE_TRACKS)
    expect(library.tracks[0]?.videoId).toBe('0000000005A')
    expect(library.tracks.filter((track) => track.videoId === '0000000005A')).toHaveLength(1)
  })

  it('ignores corrupted storage and drops malformed stored tracks safely', () => {
    const storage = new Map<string, string>()
    const key = 'youtube-test'
    const fakeStorage = {
      getItem: (storageKey: string) => storage.get(storageKey) ?? null,
      setItem: (storageKey: string, value: string) => storage.set(storageKey, value),
      removeItem: (storageKey: string) => storage.delete(storageKey),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    } satisfies Storage

    storage.set(key, '{not json')
    expect(loadYouTubeLibrary(fakeStorage, key).tracks).toEqual([])

    expect(
      parseYouTubeLibrary({
        tracks: [
          { videoId: 'dQw4w9WgXcQ', title: 'Valid video', addedAt: 10 },
          { videoId: 'bad', title: 'Invalid video', addedAt: 11 },
        ],
        selectedVideoId: 'dQw4w9WgXcQ',
      }),
    ).toMatchObject({
      selectedVideoId: 'dQw4w9WgXcQ',
      tracks: [{ videoId: 'dQw4w9WgXcQ', title: 'Valid video' }],
    })
  })

  it('removes and clears selected YouTube tracks', () => {
    const parsed = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(parsed).not.toBeNull()

    let library = upsertYouTubeTrack(parseYouTubeLibrary({}), createYouTubeTrack(parsed!))
    expect(library.selectedVideoId).toBe('dQw4w9WgXcQ')

    library = selectYouTubeTrack(library, null)
    expect(library.selectedVideoId).toBeNull()

    library = upsertYouTubeTrack(library, createYouTubeTrack(parsed!))
    library = removeYouTubeTrack(library, 'dQw4w9WgXcQ')

    expect(library.tracks).toEqual([])
    expect(library.selectedVideoId).toBeNull()
  })
})
