// 数据库表结构与 TypeScript 类型定义

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Room {
  id: number
  name: string
  is_direct: boolean
  created_by: string | null
  created_at: string
}

export interface RoomMember {
  room_id: number
  user_id: string
  joined_at: string
  profiles?: Profile
}

export interface Message {
  id: number
  room_id: number
  sender_id: string
  content: string | null
  attachment_url: string | null
  created_at: string
  profiles?: Profile
}

// 注册时传递给 auth.users.raw_user_meta_data 的元数据
export interface SignUpMetadata {
  username: string
}
