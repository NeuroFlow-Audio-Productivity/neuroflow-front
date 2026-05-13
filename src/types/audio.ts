import type { Mode } from '@/types/mode'

export type Audio = {
  id: number | string
  name: string
  path: string
  url: string
  mode_id: number | string | null
  mode?: Mode | null
  created_at: string
  updated_at: string
}
