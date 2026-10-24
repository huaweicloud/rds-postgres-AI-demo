import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Message, Profile, Room } from '../types/database'

interface Props {
  room: Room
  profile: Profile
}

interface PresencePayload {
  user_id: string
  username: string
}

export default function ChatWindow({ room, profile }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map())
  const [onlineUsers, setOnlineUsers] = useState<PresencePayload[]>([])
  const [uploading, setUploading] = useState(false)
  // 加载失败的历史图片 id 集合（桶被删或对象失效时显示占位而非破图图标）
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set())
  // user_id -> username 映射：CDC 推送的事件只含 messages 表自身字段，
  // 不含嵌套的 profiles 关系，需要用映射表解析发送者用户名
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map())

  const channelRef = useRef<RealtimeChannel | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTypingSent = useRef(0)

  // ---------- 1. 预载用户映射 + 加载历史消息 ----------
  useEffect(() => {
    let cancelled = false
    setMessages([])

    supabase
      .from('profiles')
      .select('id, username')
      .then(({ data }) => {
        if (!cancelled && data) {
          setProfilesMap(
            new Map((data as Profile[]).map((p) => [p.id, p.username])),
          )
        }
      })

    supabase
      .from('messages')
      .select('*, profiles(username)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled && data) setMessages(data as unknown as Message[])
      })

    return () => {
      cancelled = true
    }
  }, [room.id])

  // ---------- 2. 订阅频道 ----------
  // 同一个频道对象上承载三种实时能力：
  //   postgres_changes —— 数据库变更推送（CDC）
  //   broadcast        —— 「正在输入」瞬态信号（不落库）
  //   presence         —— 在线成员状态
  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`, // 服务端过滤，只推送当前房间的消息
        },
        (payload) => {
          const msg = payload.new as Message
          // 去重：发送者自己也会收到推送
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          )
        },
      )
      .on('broadcast', { event: 'typing' }, ({ payload: p }) => {
        const data = p as PresencePayload
        if (data.user_id === profile.id) return
        setTypingUsers((prev) => new Map(prev).set(data.username, Date.now()))
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flatMap((entries) =>
          (entries as unknown as PresencePayload[]).map((e) => e),
        )
        setOnlineUsers(users)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // 上报自己的在线状态
          channel.track({ user_id: profile.id, username: profile.username })
        }
      })

    channelRef.current = channel

    // 组件卸载/切换房间时移除频道，避免内存泄漏与无效连接
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [room.id, profile.id, profile.username])

  // ---------- 3. 「正在输入」状态 4 秒自动过期 ----------
  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now()
        const next = new Map([...prev].filter(([, t]) => now - t < 4000))
        return next.size === prev.size ? prev : next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ---------- 4. 新消息自动滚动到底部 ----------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // 广播「正在输入」信号（节流：2 秒最多发送一次）
  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < 2000) return
    lastTypingSent.current = now
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: profile.id, username: profile.username },
    })
  }, [profile.id, profile.username])

  // ---------- 5. 发送文本消息 ----------
  // 直接 INSERT，RLS 自动校验：sender_id 必须是自己、且必须是房间成员。
  // 写入成功后由 WAL 捕获变更，Realtime 推送给所有授权订阅者（包括自己）。
  async function sendText(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')

    const { error } = await supabase.from('messages').insert({
      room_id: room.id,
      sender_id: profile.id,
      content: text,
    })
    if (error) alert('发送失败：' + error.message)
  }

  // ---------- 6. 发送图片消息 ----------
  // 上传到 Storage（对接华为云 OBS）→ 取公开 URL → 插入一条带附件的消息
  async function sendImage(file: File) {
    setUploading(true)
    try {
      const path = `${room.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path)
      const { error } = await supabase.from('messages').insert({
        room_id: room.id,
        sender_id: profile.id,
        attachment_url: data.publicUrl,
      })
      if (error) throw error
    } catch (err) {
      alert('图片发送失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选择同一文件
    if (file) sendImage(file)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div>
          <div className="chat-room-name">{room.name}</div>
          <div className="chat-room-meta">
            {onlineUsers.length > 0
              ? `${onlineUsers.length} 人在线：${onlineUsers.map((u) => u.username).join('、')}`
              : '暂无成员在线'}
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => {
          const mine = msg.sender_id === profile.id
          const senderName =
            profilesMap.get(msg.sender_id) ??
            msg.profiles?.username ??
            '未知用户'
          return (
            <div key={msg.id} className={`msg-row ${mine ? 'mine' : ''}`}>
              <span className="avatar avatar-sm">{senderName[0].toUpperCase()}</span>
              <div className="msg-bubble">
                <div className="msg-meta">
                  <span className="msg-sender">{senderName}</span>
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                </div>
                {msg.content && <div className="msg-text">{msg.content}</div>}
                {msg.attachment_url && !brokenImages.has(msg.id) && (
                  <img
                    className="msg-image"
                    src={msg.attachment_url}
                    alt="图片消息"
                    loading="lazy"
                    onError={() =>
                      setBrokenImages((prev) => new Set(prev).add(msg.id))
                    }
                  />
                )}
                {msg.attachment_url && brokenImages.has(msg.id) && (
                  <div className="msg-image-fallback">图片已失效或不可访问</div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="typing-bar">
        {typingUsers.size > 0 && (
          <span className="typing-content">
            <strong>{[...typingUsers.keys()].join('、')}</strong> 正在输入
            <span className="typing-dots">
              <span />
              <span />
              <span />
            </span>
          </span>
        )}
      </div>

      <form className="chat-input" onSubmit={sendText}>
        <label className="icon-btn upload-btn" title="发送图片">
          {uploading ? '⏳' : '🖼'}
          <input type="file" accept="image/*" onChange={handleFileChange} hidden />
        </label>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            notifyTyping()
          }}
          placeholder="输入消息，回车发送..."
        />
        <button type="submit" disabled={!input.trim()}>
          发送
        </button>
      </form>
    </div>
  )
}
