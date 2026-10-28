# RDS Supabase 邮箱认证演示

[English](./README_EN.md) | 中文

基于华为云云数据库 RDS for PostgreSQL 的 AI 应用开发平台（RDS Supabase）构建的邮箱认证演示应用。演示了如何通过 RDS Supabase 完整实现邮箱注册确认、密码登录、Magic Link 免密登录、密码重置、邮箱更换与重新认证等全流程邮件认证能力。

## 功能特性

- 邮箱注册与确认：注册时展示密码强度指示器，注册后发送确认邮件
- 邮箱密码登录：登录后进入用户面板
- Magic Link 免密登录：向邮箱发送登录链接，点击即登录
- 密码重置：支持未登录状态（忘记密码）与登录后（内联）两种重置方式
- 邮箱更换：向新邮箱发送确认链接，面板展示待确认状态
- 重新认证：通过邮件触发 Reauthentication
- 用户面板：展示头像、用户 ID、邮箱、注册时间、最后登录时间
- 中英文切换：界面文案与错误提示均支持中英双语

## 技术栈

- [React](https://react.dev/) 18
- [Vite](https://vitejs.dev/) 5
- [@supabase/supabase-js](https://github.com/supabase/supabase-js)

## 目录结构

```text
.
├── .env                    # Supabase 环境变量配置（URL / Anon Key）
├── .env.example            # 环境变量示例模板
├── index.html              # 首页入口界面
├── package.json            # 打包依赖配置（React18 + Vite5 + Supabase）
├── vite.config.js          # Vite 构建配置
└── src                     # 核心功能源码目录
    ├── App.jsx             # 根组件：按登录态分发页面，含中英切换
    ├── main.jsx            # React 应用入口挂载
    ├── index.css           # 全局样式
    ├── components          # UI 组件目录
    │   ├── AuthForm.jsx        # 登录/注册表单
    │   ├── ChangeEmail.jsx     # 修改邮箱组件
    │   ├── Dashboard.jsx       # 登录后用户面板
    │   ├── Message.jsx         # 通用消息提示
    │   ├── ResetPassword.jsx   # 重置密码（请求/恢复模式）
    │   └── ResetPasswordInline.jsx  # 内联重置密码
    ├── context             # React 状态管理目录
    │   ├── AuthContext.jsx     # 认证状态（Supabase 会话）
    │   └── LanguageContext.jsx # 中英语言切换
    ├── i18n                # 国际化文案目录
    │   ├── en.js               # 英文文案
    │   └── zh.js               # 中文文案
    └── lib                 # 工具库目录
        ├── errors.js           # 错误码到用户提示的映射
        └── supabase.js         # Supabase 客户端初始化
```

## 快速开始

### 前提条件

- 已购买 RDS Supabase 实例，且实例状态为运行中，详见[购买 RDS Supabase 实例](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- 已绑定弹性公网 IP 并正确配置安全组出方向规则（允许访问 SMTP 服务器地址/端口），详见[绑定和解绑弹性公网IP](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_19.html)
- 已在 RDS 管理控制台完成 Auth 配置（详见下文[后端配置要点](#后端配置要点)）

### 后端配置要点

1. 登录 [RDS 管理控制台](https://console.huaweicloud.com/rds/#/rds/management/list)，进入目标 Supabase 应用的「Auth 配置」页面。
2. 在「身份验证提供商」区域配置邮箱（SMTP）参数：

| 参数 | 说明 | 示例值 |
| --- | --- | --- |
| 启用外部邮箱登录 | 启用邮箱注册功能 | 开启 |
| SMTP 主机 | SMTP 服务器地址（IPV4 或公网域名） | 192.168.1.1 |
| SMTP 端口 | 建议 SSL 加密端口 | 465 |
| SMTP 用户名 | 邮箱地址 | test_mail@spe.com |
| SMTP 密码 | 邮箱授权码（非邮箱登录密码） | - |
| 管理员邮箱 | 通常与 SMTP 用户名相同 | test_mail@spe.com |
| 邮件发件人姓名 | 收件人看到的发件人名称 | RDS Supabase |
| 邮箱自动确认 | 生产环境建议关闭 | 关闭 |
| 邮件发件速率限制 | 同一用户/IP 两次发送的最小间隔（秒） | 60 |

3. 在「访问控制」区域配置回调与跳转：

| 参数 | 说明 | 示例值 |
| --- | --- | --- |
| 项目前端地址 | 前端应用地址，邮件链接与 OAuth 回调后跳转的目标 | http://10.10.10.20:8080 |
| 应用外部访问地址 | Supabase 应用外网完整 URL，结尾不带 `/` | http://10.10.10.10:8443 |
| 重定向白名单 | redirect_to 参数的有效目标，逗号分隔，最多 10 个 | http://10.10.10.11:8080 |

> 注意：修改 Auth 配置会触发服务进程重启，请在业务低峰期操作。Auth 相关配置仅支持在 AI 应用开发平台管理界面操作，请勿在 Supabase Dashboard 中修改，否则可能导致元数据不一致。

### 配置环境变量

复制 `.env.example` 为 `.env`，填写 RDS Supabase 实例的连接信息：

```bash
# RDS Supabase 的公网访问地址
VITE_SUPABASE_URL=your-supabase-url
# RDS Supabase 的 Anon Key
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 安装并启动

```bash
npm install
npm run dev
```

开发服务器默认监听 `0.0.0.0:5173`，浏览器访问 `http://<本机IP>:5173`。

### 生产构建

```bash
npm run build
npm run preview
```

## 功能验证流程

以 Foxmail 企业邮箱（`test_mail@spe.com`）为例：

1. **注册邮箱**：在登录页切换到「注册」标签页，输入邮箱和密码（页面实时展示密码强度），创建账户后按提示查收确认邮件。
2. **确认邮箱**：在邮箱中找到来自 RDS Supabase 的确认邮件，点击「Confirm your email address」链接完成验证，浏览器自动跳回应用。
3. **登录**：在「登录」标签页输入邮箱和密码，成功后进入 Dashboard，展示头像、用户 ID、注册时间和最后登录时间。
4. **Magic Link 免密登录**：退出登录后切换到「Magic Link」标签页，输入已注册邮箱，查收邮件并点击「Log In」链接，自动完成登录。
5. **重置密码**：未登录状态点击「忘记密码」，输入邮箱发送重置链接；在邮件中点击「Reset Password」，跳转后设置新密码。登录后也可在 Dashboard 中内联重置。
6. **更换邮箱**：登录后在 Dashboard 点击「更换邮箱」，输入新邮箱并发送确认邮件；面板显示新邮箱待确认状态，在新邮箱中点击确认链接后完成更换。
7. **重新认证**：在 Dashboard 点击「重新认证」，查收邮件并按提示完成验证。

## 自定义邮件模板（可选）

RDS Supabase 默认使用内置英文邮件模板，支持两类自定义方案：

- **方案一：通过 URL 配置远程模板**。将自定义 HTML 模板上传到 Supabase Storage 的公开 Bucket，在「Auth 配置 > 邮件配置」中填写模板 URL（`http(s)://<应用地址>/storage/v1/object/public/<Bucket>/<文件名>`）。
- **方案二：通过控制台直接填写模板内容（推荐）**。在各模板输入框中直接填写 HTML 内容，无需额外搭建 Storage；两者同时配置时本方案优先级更高。

支持的邮件模板类型与占位符：

| 模板类型 | 用途 | 占位符 |
| --- | --- | --- |
| confirmation | 注册确认邮件 | `{{ .ConfirmationURL }}`、`{{ .Token }}` |
| invite | 邀请用户邮件 | `{{ .ConfirmationURL }}`、`{{ .Token }}`、`{{ .SiteURL }}` |
| recovery | 密码重置邮件 | `{{ .ConfirmationURL }}`、`{{ .Token }}` |
| email_change | 邮箱变更确认邮件 | `{{ .ConfirmationURL }}`、`{{ .Token }}`、`{{ .Email }}`、`{{ .NewEmail }}` |
| magic_link | Magic Link 登录邮件 | `{{ .ConfirmationURL }}`、`{{ .SiteURL }}` |
| reauthentication | 重新认证邮件 | `{{ .Token }}` |

链接与验证码默认有效期为 1 小时。完整模板示例与配置步骤参见[自定义邮件模板](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html)。

## 参考文档

- [RDS Supabase AI 应用对接 SMTP 服务器并开启邮箱认证（最佳实践）](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html)
- [RDS Supabase 邮箱认证演示源码配置指导（最佳实践）](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0003.html)
- [用户认证 Auth 配置管理（用户指南）](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)
- [Supabase Email Templates（官方文档）](https://supabase.com/docs/guides/auth/auth-email-templates)

## 许可证

[Apache-2.0](./LICENSE)
