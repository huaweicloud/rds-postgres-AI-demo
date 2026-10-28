[English](README.en.md) | 简体中文

# RDS PostgreSQL AI 应用实践演示合集

华为云云数据库 RDS for PostgreSQL 持续面向 AI 应用场景提供丰富的数据库能力。本仓库汇集基于这些能力构建的最佳实践演示 Demo：每个演示围绕一个典型的数据库 AI 应用场景，提供可直接运行的完整示例工程，并以独立分支维护。

目前上线的能力为 **AI 应用开发平台（RDS Supabase）**，合集内现有演示均基于其构建——认证、实时推送、存储等后端能力由平台提供，无需自建服务。后续将随着更多 AI 应用能力上线，持续扩充演示合集。

## 仓库结构

```
rds-postgres-AI-demo
├── main                            # 汇总索引：所有最佳实践与演示的全景概览（当前页面）
└── rds-supabase-showcase-<name>    # 各实践演示工程分支
    ├── README.md                   # 完整使用指南（环境准备、配置步骤、验证方法）
    └── src/                        # 可直接运行的演示源码
```

- **分支即演示**：每个 `rds-supabase-showcase-*` 分支对应一个独立演示，互不依赖。
- **Release 即源码包**：每个演示在 GitHub Releases 提供同名 zip 源码包，下载解压即可运行，无需克隆仓库。

## 演示全景概览

| 序号 | 实践名称 | 简要说明 | 最佳实践文档 | 代码分支 | 源码下载 |
| --- | --- | --- | --- | --- | --- |
| 1 | [RDS Supabase 实时聊天](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-realtime-chatroom) | 基于 Realtime 与 RLS（行级安全策略）构建的单聊/群聊应用：消息毫秒级实时推送、图片消息（Storage 对接 OBS）、正在输入提示、在线状态展示，数据隔离由数据库层强制保障，无需自建 WebSocket 服务与后端代码 | [RDS Supabase 应用介绍](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_01.html) | `rds-supabase-showcase-realtime-chatroom` | [rds-supabase-showcase-realtime-chatroom.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-realtime-chatroom/rds-supabase-showcase-realtime-chatroom.zip) |
| 2 | [RDS Supabase 邮箱认证](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-email-auth) | 对接 SMTP 服务器开启邮箱认证：邮箱注册确认、密码登录、Magic Link 免密登录、密码重置、邮箱更换与重新认证等全流程邮件认证能力演示 | [对接 SMTP 服务器并开启邮箱认证](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html) | `rds-supabase-showcase-email-auth` | [rds-supabase-showcase-email-auth.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-email-auth/rds-supabase-showcase-email-auth.zip) |
| 3 | [RDS Supabase GitHub SSO](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-github-sso) | 接入 GitHub OAuth 2.0 单点登录：使用 GitHub 凭证一键登录，会话持久化与令牌自动刷新、用户信息仪表盘、中英文双语界面 | [开启 GitHub 第三方认证登录](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0002.html) | `rds-supabase-showcase-github-sso` | [rds-supabase-showcase-github-sso.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-github-sso/rds-supabase-showcase-github-sso.zip) |

## 快速开始

1. **获取演示源码**（任选其一）：
   - 直接下载上表「源码下载」列的 zip 包并解压；
   - 或克隆对应演示分支（分支名与源码包同名）：
     ```bash
     git clone -b <branch> https://github.com/huaweicloud/rds-postgres-AI-demo.git
     ```
2. **配置连接信息**：按演示包内 README.md 指引，在 RDS 管理控制台获取 Supabase 应用的公网访问地址与 Anon Key，配置到 `.env` 文件。
3. **本地运行**：
   ```bash
   npm install
   npm run dev
   ```

## 通用前提条件

- 已创建 RDS for PostgreSQL 实例并开通 Supabase 应用（AI 应用开发平台），操作指引参见 [RDS Supabase 应用介绍](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_01.html)。
- 本地已安装 Node.js（建议 20 LTS 及以上版本）。
- 各演示的专属前提条件（如 GitHub OAuth 应用、SMTP 配置、安全组规则等）详见其包内 README.md。

## 参考文档

- [AI 应用开发平台最佳实践目录](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0000.html)
- [RDS Supabase 应用](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- [用户认证 Auth 配置管理](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)
