-- ============================================================
-- 华为云 RDS Supabase 实时聊天应用 - 数据库初始化脚本
-- 在 Supabase Studio 的 SQL Editor 中一次性执行本脚本
-- ============================================================

-- ------------------------------------------------------------
-- 1. 创建业务表
-- ------------------------------------------------------------

-- 用户资料表：注册后由触发器自动填充
CREATE TABLE IF NOT EXISTS public.profiles (
    id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username   text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 聊天室表：每条记录代表一个单聊或群聊
CREATE TABLE IF NOT EXISTS public.rooms (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       text NOT NULL,
    is_direct  boolean NOT NULL DEFAULT false,  -- true = 单聊, false = 群聊
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now()
);

-- 成员表：聊天室与用户的归属关系
CREATE TABLE IF NOT EXISTS public.room_members (
    room_id   bigint REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON public.room_members(user_id);

-- 消息表：文本 + 图片附件统一存储
CREATE TABLE IF NOT EXISTS public.messages (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id        bigint NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    sender_id      uuid NOT NULL REFERENCES public.profiles(id),
    content        text,                          -- 文本内容
    attachment_url text,                          -- 图片/文件的 OBS 公开地址
    created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room_id, created_at DESC);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
        NEW.id,
        coalesce(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. 启用 RLS 并定义策略（数据库层强制访问控制）
-- ------------------------------------------------------------

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;

-- 成员资格检查函数：SECURITY DEFINER 以表所有者身份查询，
-- 不触发 room_members 自身的 RLS，避免「策略查自己 → 无限递归」
CREATE OR REPLACE FUNCTION public.is_room_member(room bigint)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.room_members m
        WHERE m.room_id = is_room_member.room AND m.user_id = auth.uid()
    );
$$;

-- profiles：已认证用户可互相查看（用于找人建会话）
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- rooms：仅成员可见（通过 SECURITY DEFINER 函数判断，避免递归）
DROP POLICY IF EXISTS rooms_member_select ON public.rooms;
CREATE POLICY rooms_member_select ON public.rooms
    FOR SELECT TO authenticated
    USING (public.is_room_member(rooms.id));

-- rooms：创建者可读自己创建的房间。
-- PostgREST 的 INSERT ... RETURNING 需要 SELECT 权限才能返回新建行的 id
DROP POLICY IF EXISTS rooms_creator_select ON public.rooms;
CREATE POLICY rooms_creator_select ON public.rooms
    FOR SELECT TO authenticated
    USING (created_by = auth.uid());

-- rooms：已认证用户可创建，但创建者必须是本人
DROP POLICY IF EXISTS rooms_insert ON public.rooms;
CREATE POLICY rooms_insert ON public.rooms
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- room_members：能看到自己，以及与自己同房间的其他成员
DROP POLICY IF EXISTS members_select ON public.room_members;
CREATE POLICY members_select ON public.room_members
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_room_member(room_members.room_id)
    );

-- room_members：仅房间创建者可插入成员记录（含创建者本人）。
-- 安全注意：不能加「user_id = auth.uid() 则允许」的分支——
-- 那等于允许任何认证用户把自己塞进任意房间（room_id 可枚举），
-- 加入后即可读取该房间全部消息，属于自我提权漏洞
DROP POLICY IF EXISTS members_insert ON public.room_members;
CREATE POLICY members_insert ON public.room_members
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rooms r
            WHERE r.id = room_members.room_id AND r.created_by = auth.uid()
        )
    );

-- messages【核心安全层】：仅房间成员可读取该房间的消息。
-- Realtime 推送消息时，会按订阅者逐一评估本策略——
-- 即使非成员建立了 WebSocket 连接，也收不到任何消息。
DROP POLICY IF EXISTS messages_member_select ON public.messages;
CREATE POLICY messages_member_select ON public.messages
    FOR SELECT TO authenticated
    USING (public.is_room_member(messages.room_id));

-- messages：只能以自己的身份、向自己所在的房间发送消息
DROP POLICY IF EXISTS messages_member_insert ON public.messages;
CREATE POLICY messages_member_insert ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.room_members m
            WHERE m.room_id = messages.room_id AND m.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------
-- 3. 授予 authenticated 角色最小必要权限
-- （显式授权，不依赖平台默认行为；权限不足时前端会报
--   permission denied for table xxx）
-- ------------------------------------------------------------

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.rooms TO authenticated;
GRANT SELECT, INSERT ON public.room_members TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;

-- ------------------------------------------------------------
-- 4. 配置 Realtime（CDC 变更捕获）
-- ------------------------------------------------------------

-- REPLICA IDENTITY FULL：确保 WAL 变更事件包含完整行数据，
-- 否则客户端只能收到主键字段
ALTER TABLE public.messages     REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;

-- 加入 publication 后 Realtime 服务才会捕获该表的变更
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;

-- ------------------------------------------------------------
-- 5. 配置 Storage（聊天图片，对接华为云 OBS）
-- ------------------------------------------------------------

-- 创建公开读的附件桶（也可在 Studio 的 Storage 页面创建）
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 已认证用户可上传附件
CREATE POLICY attachments_upload ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-attachments');

-- 已认证用户可读取附件元数据
CREATE POLICY attachments_read ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'chat-attachments');

-- ------------------------------------------------------------
-- 6. 通知 Data API（PostgREST）重新加载 schema 缓存
-- 通过 Studio 执行时 Studio 会自动通知；通过 psql 等直连执行时
-- 由本语句兜底，确保新建的表立即可通过 REST API 访问
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
