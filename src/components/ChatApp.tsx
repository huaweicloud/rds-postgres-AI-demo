import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Profile, Room } from '../types/database'
import RoomList from './RoomList'
import ChatWindow from './ChatWindow'

export default function ChatApp() {
  const { session } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  useEffect(() => {
    if (!session?.user) return
    // profile 由注册时的数据库触发器自动创建
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile)
      })
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!profile) {
    return <div className="center-screen">加载用户信息...</div>
  }

  return (
    <div className="chat-app">
      <header className="topbar">
        <span className="app-title">RDS Supabase 实时聊天</span>
        <div className="topbar-user">
          <span className="avatar avatar-sm">{profile.username[0].toUpperCase()}</span>
          <span>{profile.username}</span>
          <button className="link-btn" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <div className="chat-body">
        <RoomList
          currentUserId={profile.id}
          selectedRoomId={selectedRoom?.id ?? null}
          onSelect={setSelectedRoom}
        />
        <main className="chat-main">
          {selectedRoom ? (
            <ChatWindow key={selectedRoom.id} room={selectedRoom} profile={profile} />
          ) : (
            <div className="empty-state">
              选择或创建一个会话，开始实时聊天
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
