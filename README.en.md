English | [简体中文](README.md)

# RDS PostgreSQL AI Application Demo Showcase

Huawei Cloud RDS for PostgreSQL continuously delivers a rich set of database capabilities for AI application scenarios. This repository collects the best-practice demos built on top of these capabilities: each demo targets a typical database-backed AI application scenario, ships as a complete, ready-to-run sample project, and is maintained on its own dedicated branch.

The capability currently available is the **AI application development platform (RDS Supabase)**, and all demos in this collection are built on it — backend capabilities such as authentication, realtime messaging, and storage are provided by the platform, so no self-hosted services are required. The collection will keep growing as more AI application capabilities come online.

## Repository Structure

```
rds-postgres-AI-demo
├── main                            # Index: overview of all best practices and demos (this page)
└── rds-supabase-showcase-<name>    # Demo project branches, one per practice
    ├── README.md                   # Complete usage guide (prerequisites, configuration steps, verification)
    └── src/                        # Ready-to-run demo source code
```

- **One branch, one demo**: each `rds-supabase-showcase-*` branch hosts an independent, self-contained demo with no cross-dependencies.
- **Releases are the source packages**: every demo publishes a same-named zip source package on GitHub Releases — download, unzip, and run, without cloning the repository.

## Demo Overview

| No. | Practice Name | Description | Best Practice Guide | Code Branch | Source Download |
| --- | --- | --- | --- | --- | --- |
| 1 | [RDS Supabase Realtime Chatroom](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-realtime-chatroom) | A 1:1 and group chat application built on Realtime and RLS (Row-Level Security): millisecond-level message delivery, image messages (Storage backed by OBS), typing indicators, and online presence, with data isolation enforced at the database layer — no self-built WebSocket service or backend code required | [Introduction to RDS Supabase](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_01.html) | `rds-supabase-showcase-realtime-chatroom` | [rds-supabase-showcase-realtime-chatroom.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-realtime-chatroom/rds-supabase-showcase-realtime-chatroom.zip) |
| 2 | [RDS Supabase Email Auth](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-email-auth) | Email authentication with an integrated SMTP server: a full walkthrough of email-based auth — signup with email confirmation, password sign-in, Magic Link passwordless login, password reset, email change, and re-authentication | [Integrate an SMTP Server and Enable Email Authentication](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html) | `rds-supabase-showcase-email-auth` | [rds-supabase-showcase-email-auth.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-email-auth/rds-supabase-showcase-email-auth.zip) |
| 3 | [RDS Supabase GitHub SSO](https://github.com/huaweicloud/rds-postgres-AI-demo/tree/rds-supabase-showcase-github-sso) | GitHub OAuth 2.0 single sign-on: one-click sign-in with GitHub credentials, persistent sessions with automatic token refresh, a user info dashboard, and a bilingual (English/Chinese) interface | [Enable GitHub Third-Party Authentication](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0002.html) | `rds-supabase-showcase-github-sso` | [rds-supabase-showcase-github-sso.zip](https://github.com/huaweicloud/rds-postgres-AI-demo/releases/download/rds-supabase-showcase-github-sso/rds-supabase-showcase-github-sso.zip) |

## Quick Start

1. **Get the demo source** (either option):
   - Download the zip package from the "Source Download" column in the table above and unzip it;
   - Or clone the corresponding demo branch (the branch name is the same as the package name):
     ```bash
     git clone -b <branch> https://github.com/huaweicloud/rds-postgres-AI-demo.git
     ```
2. **Configure the connection info**: following the README.md inside the package, obtain the public URL and Anon Key of your Supabase application from the RDS management console and fill them into the `.env` file.
3. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```

## General Prerequisites

- An RDS for PostgreSQL instance with the Supabase application (the AI application development platform) enabled. See [Introduction to RDS Supabase](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_01.html) for step-by-step instructions.
- Node.js installed locally (20 LTS or later recommended).
- Demo-specific prerequisites (such as a GitHub OAuth app, SMTP settings, or security group rules) are detailed in the README.md inside each package.

## References

- [AI Application Development Platform Best Practices](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0000.html)
- [RDS Supabase Application](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- [Auth Configuration Management](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)
