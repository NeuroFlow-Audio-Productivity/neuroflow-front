import type { Audio } from '@/types/audio'
import type { Mode } from '@/types/mode'

export type Flow = {
  id: number
  name: string
  user_id: number
  created_at: string
  updated_at: string
}

export type FlowNode = {
  id: number
  title: string
  flow_id: number
  mode_id: number
  end_audio_id: number | null
  order: number
  time: number
  flow?: Flow
  mode?: Mode
  end_audio?: Audio | null
  created_at: string
  updated_at: string
}
