import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Room } from '../types/database'
import CreateRoomModal from './CreateRoomModal'

interface Props {
  currentUserId: string
  selectedRoomId: number | null
  onSelect: (room: Room) => void
}

export default function RoomList({ currentUserId, selectedRoomId, onSelect }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [showModal, setShowModal] = useState(false)

  const loadRooms = useCallback(async () => {
    // 查询自己所在的房间（RLS 自动过滤，只会返回自己是成员的房间）
    const { data } = await supabase
      .from('room_members')
      .select('rooms(*)')
      .eq('user_id', currentUserId)
      .order('joined_at', { ascending: false })

    if (data) {
      const seen = new Set<number>()
      const list: Room[] = []
      for (const row of data as unknown as { rooms: Room | null }[]) {
        if (row.rooms && !seen.has(row.rooms.id)) {
          seen.add(row.rooms.id)
          list.push(row.rooms)
        }
      }
      setRooms(list)
    }
  }, [currentUserId])

  useEffect(() => {
    loadRooms()

    // 订阅 room_members 变更：创建群聊或被拉入新群时，列表实时刷新。
    // 非成员的房间变更会被 RLS 过滤，不会推送过来。
    const channel = supabase
      .channel('room-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members' },
        () => loadRooms(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadRooms])

  function handleCreated(roomId: number, room: Room) {
    setShowModal(false)
    loadRooms()
    onSelect(room)
    void roomId
  }

  return (
    <aside className="room-list">
      <div className="room-list-header">
        <span>会话</span>
        <button className="icon-btn" title="新建会话" onClick={() => setShowModal(true)}>
          +
        </button>
      </div>

      {rooms.length === 0 && (
        <div className="room-list-empty">还没有会话，点击 + 创建</div>
      )}

      <ul>
        {rooms.map((room) => (
          <li
            key={room.id}
            className={`room-item ${room.id === selectedRoomId ? 'active' : ''}`}
            onClick={() => onSelect(room)}
          >
            <span className={`avatar ${room.is_direct ? 'avatar-direct' : 'avatar-group'}`}>
              {room.is_direct ? room.name[0].toUpperCase() : '#'}
            </span>
            <div className="room-item-info">
              <div className="room-item-name">{room.name}</div>
              <div className="room-item-type">{room.is_direct ? '单聊' : '群聊'}</div>
            </div>
          </li>
        ))}
      </ul>

      {showModal && (
        <CreateRoomModal
          currentUserId={currentUserId}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </aside>
  )
}
