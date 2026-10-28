# RDS Supabase GitHub SSO 示例应用

基于华为云 RDS Supabase（AI 应用开发平台）Auth 服务接入 GitHub OAuth 2.0 单点登录的前端示例应用：将 GitHub 配置为第三方身份提供商，用户无需另行注册账号，直接使用 GitHub 凭证即可完成安全认证与登录。示例完整展示了从认证流程配置、会话管理到用户信息展示的前端实现方案，帮助开发者快速理解并复用相同模式。

## 功能特性

- **GitHub OAuth 2.0 单点登录**：一键跳转 GitHub 授权，无需自建认证后端
- **会话管理**：会话持久化存储、令牌自动刷新、OAuth 回调地址自动识别
- **用户信息仪表盘**：展示头像、用户名、用户 ID、邮箱、登录方式、登录时间，支持一键复制 Access Token
- **路由守卫**：未登录访问受保护页面自动跳转登录页，已登录访问登录页自动进入仪表盘
- **中英文双语**：内置 i18n 国际化，右上角一键切换语言

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | React 18 |
| 构建工具 | Vite 6 |
| 路由 | React Router 6 |
| BaaS SDK | @supabase/supabase-js v2 |
| 认证后端 | 华为云 RDS Supabase Auth |

> 本示例默认在本地部署演示，也可以部署在云上 ECS 机器中并开启公网访问。Demo 演示场景下不开启 SSL，仅使用 HTTP 方式访问。

## 前提条件

- 已创建 RDS Supabase 应用且应用状态正常，并已绑定弹性公网 IP。由于第三方身份提供商（GitHub）的服务器部署在国外，为保证网络可达性和稳定性、避免延迟过高导致认证与访问超时，**建议购买国外区域的 RDS Supabase 应用**。
- 已开启“允许新用户注册”：在 Supabase 应用详情页，选择“Auth配置 > 用户注册配置”，打开配置开关。未开启时 GitHub 新用户无法成功注册并登录。
- 已配置安全组规则，要求 RDS Supabase 与 GitHub、浏览器、前端项目网络互通：
  - 入方向规则：放通 IPv4 TCP 8443 端口，源地址包含 GitHub、浏览器与前端应用地址
  - 出方向规则：放通 IPv4 TCP 所有端口，目的地址包含 GitHub、浏览器与前端应用地址
- 本地已安装 [Node.js](https://nodejs.org) 20 LTS 及以上版本。
- 已注册 GitHub 账号并绑定邮箱，浏览器可正常访问 [GitHub](https://github.com)（建议使用 Chrome 或 Edge，不支持 IE）。
- 本地 PC 或服务器支持公网访问，且 5173 端口未被占用。

## 快速开始

### 步骤 1：获取 RDS Supabase 连接信息

1. [登录 RDS 管理控制台](https://console.huaweicloud.com/rds/#/rds/management/list)，在左侧导航栏选择“AI应用开发平台”，在应用列表中找到目标 Supabase 应用。
2. 单击“操作”列的“登录应用”，在弹窗中选择 EIP 登录方式，进入 Supabase Dashboard。
3. 单击页面左上方“Connect”，选择“App Frameworks”，Framework 下拉框勾选“React”，获取环境变量：

| 配置项 | 对应环境变量 | 取值示例 |
| --- | --- | --- |
| Supabase 公网访问地址 | VITE_SUPABASE_URL | http://10.x.x.x:8443 |
| Supabase Anon API Key | VITE_SUPABASE_ANON_KEY | ********** |

### 步骤 2：创建 GitHub OAuth 应用

1. 进入 [GitHub 开发者配置页面](https://github.com/settings/developers)，单击“New OAuth App”注册一个新的 OAuth 应用。

| 配置项 | 配置说明 | 取值示例 |
| --- | --- | --- |
| Application name | OAuth App 应用名称，建议填写网站名、软件名或公司名 | supabase sso demo |
| Homepage URL | 前端应用主页地址，为本机 PC 或服务器的公网 IP + 5173 端口，需与 RDS Supabase、GitHub 网络互通 | http://10.x.x.x:5173 |
| Authorization callback URL（旧版）/ Redirect URI（新版） | 授权回调地址。GitHub 验证用户登录成功后，将临时授权码（Code）发送到该 URI，Supabase 后端捕获该请求后自动建号或登录，再将用户重定向回前端页面。格式为 {Supabase公网访问地址}/auth/v1/callback | http://10.x.x.x:8443/auth/v1/callback |

2. 注册成功后，在 OAuth 应用详情页单击“Generate a new client secret”创建安全密钥，并立即拷贝生成的密钥值（**只会在创建时完整展示一次**），同时获取 Client ID。

> **注意**：请务必妥善保管 Client Secret，不慎泄露将导致严重的安全隐患。建议删除不再使用的旧密钥。

### 步骤 3：配置 RDS Supabase Auth

1. 进入 RDS 管理控制台的 Supabase 应用详情页，在左侧导航栏选择“Auth”。
2. 单击“访问控制”模块的“修改访问控制”：
   - **项目前端地址**：填写步骤 2 中的 Homepage URL
   - **应用外部访问地址**：填写步骤 1 中获取的 Supabase 公网访问地址
   - **重定向白名单**：不填写
3. 打开“身份验证提供商”模块中的 GitHub 配置开关：
   - **GitHub OAuth App 的 Client ID / Client Secret**：填写步骤 2 获取的值
   - **授权回调地址**：填写步骤 2 中的 Authorization callback URL

### 步骤 4：配置并启动前端

```bash
# 克隆本仓库
git clone -b rds-supabase-showcase-github-sso https://github.com/huaweicloud/rds-postgres-AI-demo.git
cd rds-postgres-AI-demo

# 复制环境变量模板并填入步骤 1 获取的连接信息
cp .env.example .env
# VITE_SUPABASE_URL=http://10.x.x.x:8443
# VITE_SUPABASE_ANON_KEY=**********

# 安装依赖（请确保 npm 源可用，连接不稳定或超时请切换其他可用源）
npm install

# 启动前端应用
npm run dev
```

启动成功后，控制台会回显所有可访问地址（默认端口 5173）。

### 步骤 5：GitHub SSO 登录测试

1. 本地浏览器打开前端访问地址（即 Homepage URL）：`http://{本机公网IP}:5173`。
2. 单击“使用 GitHub 登录”，触发 GitHub 与 RDS Supabase 的 OAuth 用户认证，浏览器跳转至 `https://github.com/login/oauth/authorize?client_id=...`。授权确认视图只会出现一次，后续登出再重新登录不会再次展示。
3. 单击“Authorize xxx”完成授权，系统自动重定向回 `http://{本机公网IP}:5173/demo`，展示登录用户的凭证信息（头像、用户名、用户 ID、邮箱、Access Token、登录方式、登录时间等）。
4. （可选）进入 RDS Supabase Dashboard，选择“Authentication”，在用户列表中可看到一条新的用户注册和登录记录，其中 Providers 为 GitHub，Email 为 GitHub 账号绑定的邮箱。

## SSO 认证流程

1. **发起授权**：点击登录后，应用通过 Supabase 向 GitHub OAuth 发起授权请求
2. **GitHub 授权**：跳转至 GitHub 页面，由您确认授权应用访问您的账号信息
3. **回调换令牌**：GitHub 授权后携带 code 回调本应用，Supabase 用 code 换取 Access Token
4. **建立会话**：Supabase 创建用户会话，自动返回本应用并完成登录

## 项目结构

```
├── .env.example                  # 环境变量模板（复制为 .env 并填写）
├── .github/                      # CI 工作流与 Issue/PR 模板
├── .gitignore
├── CONTRIBUTING.md               # 贡献指南
├── LICENSE                       # Apache License 2.0
├── README.md
├── index.html                    # 首页界面
├── package.json                  # 打包依赖配置
├── package-lock.json
├── public/                       # 静态资源
│   └── vite.svg
├── vite.config.js                # Vite 构建配置
└── src                           # 核心功能源码目录
    ├── App.jsx                   # 路由与全局布局（含路由守卫）
    ├── main.jsx                  # 应用入口
    ├── index.css                 # 全局样式
    ├── components
    │   ├── Dashboard.jsx         # 登录后用户信息仪表盘
    │   └── Login.jsx             # GitHub 登录页
    ├── context
    │   ├── AuthContext.jsx       # 认证上下文（会话管理/登入登出）
    │   └── LanguageContext.jsx   # 语言上下文（中英文切换）
    ├── i18n
    │   └── index.js              # 中英文文案
    └── lib
        └── supabaseClient.js     # Supabase 客户端初始化
```

## 常见问题

| 现象 | 原因与解决 |
| --- | --- |
| 认证跳转缓慢或超时 | GitHub 服务器部署在国外，建议购买国外区域的 RDS Supabase 应用，并检查安全组出方向规则是否放通 |
| GitHub 新用户无法注册登录 | 未开启“允许新用户注册”，请在 Auth配置 > 用户注册配置 中打开开关 |
| Client Secret 遗忘 | 仅创建时完整展示一次，需在 GitHub 重新生成，并同步更新 RDS Supabase Auth 配置 |
| 前端启动失败 | 5173 端口被占用，释放端口或修改 vite.config.js 中的端口配置 |
| 页面报缺少环境变量 | 未创建 .env（可从 .env.example 复制模板）或未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，或修改后未重启应用 |
| npm install 超时 | npm 源不可用或连接不稳定，请切换其他可用源 |

## 参考文档

- [RDS Supabase AI应用开启GitHub第三方认证登录（最佳实践）](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0002.html)
- [RDS Supabase GitHub SSO演示源码配置指导](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0004.html)
- [RDS Supabase应用](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- [用户认证Auth配置管理](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。
