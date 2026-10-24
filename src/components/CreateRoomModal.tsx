import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Room } from '../types/database'

interface Props {
  currentUserId: string
  onClose: () => void
  onCreated: (roomId: number, room: Room) => void
}

type Tab = 'direct' | 'group'

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err)
}

export default function CreateRoomModal({ currentUserId, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>('direct')
  const [users, setUsers] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // profiles 的 RLS 允许已认证用户互相查看，用于找人建会话
    supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId)
      .order('username')
      .then(({ data }) => {
        if (data) setUsers(data as Profile[])
      })
  }, [currentUserId])

  async function createDirect(other: Profile) {
    setBusy(true)
    try {
      // 幂等：先查找两人之间是否已存在单聊
      const { data: myDirects } = await supabase
        .from('room_members')
        .select('room_id, rooms!inner(is_direct)')
        .eq('user_id', currentUserId)
        .eq('rooms.is_direct', true)

      if (myDirects && myDirects.length > 0) {
        const ids = (myDirects as { room_id: number }[]).map((r) => r.room_id)
        const { data: shared } = await supabase
          .from('room_members')
          .select('room_id')
          .in('room_id', ids)
          .eq('user_id', other.id)

        if (shared && shared.length > 0) {
          const roomId = (shared[0] as { room_id: number }).room_id
          const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single()
          if (room) onCreated(roomId, room as Room)
          return
        }
      }

      // 不存在则创建新单聊
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({ name: other.username, is_direct: true, created_by: currentUserId })
        .select()
        .single()
      if (error) throw error

      const { error: memberError } = await supabase.from('room_members').insert([
        { room_id: room.id, user_id: currentUserId },
        { room_id: room.id, user_id: other.id },
      ])
      if (memberError) throw memberError

      onCreated(room.id, room as Room)
    } catch (err) {
      alert('创建失败：' + toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function createGroup() {
    if (!groupName.trim() || selected.size === 0) return
    setBusy(true)
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          name: groupName.trim(),
          is_direct: false,
          created_by: currentUserId,
        })
        .select()
        .single()
      if (error) throw error

      const members = [
        { room_id: room.id, user_id: currentUserId },
        ...[...selected].map((uid) => ({ room_id: room.id, user_id: uid })),
      ]
      const { error: memberError } = await supabase.from('room_members').insert(members)
      if (memberError) throw memberError

      onCreated(room.id, room as Room)
    } catch (err) {
      alert('创建失败：' + toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <button
            className={tab === 'direct' ? 'active' : ''}
            onClick={() => setTab('direct')}
          >
            单聊
          </button>
          <button
            className={tab === 'group' ? 'active' : ''}
            onClick={() => setTab('group')}
          >
            群聊
          </button>
        </div>

        {tab === 'group' && (
          <input
            className="group-name-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="输入群聊名称"
            maxLength={50}
          />
        )}

        <div className="user-picker">
          {users.length === 0 && (
            <div className="room-list-empty">暂无其他用户，先注册另一个账号吧</div>
          )}
          {users.map((user) => (
            <label
              key={user.id}
              className={`user-option ${tab === 'group' && selected.has(user.id) ? 'checked' : ''}`}
            >
              <input
                type={tab === 'group' ? 'checkbox' : 'radio'}
                name="user"
                checked={tab === 'group' ? selected.has(user.id) : undefined}
                onChange={() => (tab === 'group' ? toggleUser(user.id) : createDirect(user))}
                disabled={busy}
              />
              <span className="avatar avatar-sm">{user.username[0].toUpperCase()}</span>
              <span>{user.username}</span>
            </label>
          ))}
        </div>

        {tab === 'group' && (
          <button
            className="primary-btn"
            onClick={createGroup}
            disabled={busy || !groupName.trim() || selected.size === 0}
          >
            创建群聊（已选 {selected.size} 人）
          </button>
        )}
      </div>
    </div>
  )
}
