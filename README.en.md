English | [简体中文](README.md)

# RDS Supabase GitHub SSO Demo

A frontend demo application that integrates GitHub OAuth 2.0 single sign-on (SSO) through the Auth service of Huawei Cloud RDS Supabase (AI Application Development Platform). With GitHub configured as a third-party identity provider, users can authenticate and sign in securely using their GitHub credentials—no separate account registration required. The demo shows the complete frontend implementation, from auth flow configuration and session management to user information display, helping developers quickly understand and reuse the same pattern.

## Features

- **GitHub OAuth 2.0 SSO**: one-click redirect to GitHub authorization, no self-built auth backend required
- **Session management**: persistent session storage, automatic token refresh, automatic OAuth callback detection
- **User dashboard**: displays avatar, username, user ID, email, login method, and login time, with one-click Access Token copy
- **Route guards**: unauthenticated visits to protected pages redirect to the login page; authenticated visits to the login page go straight to the dashboard
- **Bilingual UI (English / 中文)**: built-in i18n, switch languages with one click in the top-right corner

## Tech Stack

| Category | Technology |
| --- | --- |
| Frontend framework | React 18 |
| Build tool | Vite 6 |
| Routing | React Router 6 |
| BaaS SDK | @supabase/supabase-js v2 |
| Auth backend | Huawei Cloud RDS Supabase Auth |

> By default this demo runs locally; it can also be deployed on a cloud ECS instance with public access enabled. SSL is not enabled in the demo scenario—HTTP only.

## Prerequisites

- An RDS Supabase application is created and running normally, with an elastic public IP (EIP) bound. Since the third-party identity provider (GitHub) hosts its servers overseas, **purchasing the RDS Supabase application in an overseas region is recommended** to guarantee network reachability and stability and avoid authentication/access timeouts caused by high latency.
- "Allow new user sign-ups" is enabled: on the Supabase application detail page, choose "Auth Configuration > User Sign-up Configuration" and turn on the switch. When disabled, new GitHub users cannot register or sign in.
- Security group rules are configured so that RDS Supabase, GitHub, the browser, and the frontend project can reach each other:
  - Inbound rule: allow IPv4 TCP port 8443; source addresses must cover GitHub, the browser, and the frontend application
  - Outbound rule: allow IPv4 TCP on all ports; destination addresses must cover GitHub, the browser, and the frontend application
- [Node.js](https://nodejs.org) 20 LTS or later is installed locally.
- A GitHub account with a bound email address, and a browser that can access [GitHub](https://github.com) (Chrome or Edge recommended; IE is not supported).
- The local PC or server has public network access, and port 5173 is not occupied.

## Quick Start

### Step 1: Get the RDS Supabase connection information

1. [Sign in to the RDS management console](https://console.huaweicloud.com/rds/#/rds/management/list), choose "AI Application Development Platform" in the left navigation pane, and locate the target Supabase application in the application list.
2. Click "Log In to App" in the Operation column, select the EIP login method in the dialog, and enter the Supabase Dashboard.
3. Click "Connect" at the top left of the page, choose "App Frameworks", select "React" in the Framework dropdown, and obtain the environment variables:

| Item | Environment variable | Example value |
| --- | --- | --- |
| Supabase public URL | VITE_SUPABASE_URL | http://10.x.x.x:8443 |
| Supabase Anon API Key | VITE_SUPABASE_ANON_KEY | ********** |

### Step 2: Create a GitHub OAuth application

1. Go to the [GitHub developer settings page](https://github.com/settings/developers) and click "New OAuth App" to register a new OAuth application.

| Field | Description | Example value |
| --- | --- | --- |
| Application name | OAuth application name. Your website, product, or company name is recommended. | supabase sso demo |
| Homepage URL | Frontend homepage URL: public IP of your local PC or server plus port 5173. It must be reachable from both RDS Supabase and GitHub. | http://10.x.x.x:5173 |
| Authorization callback URL (legacy UI) / Redirect URI (new UI) | Authorization callback URL. After GitHub verifies the user's login, it sends a temporary authorization code to this URI. The Supabase backend captures the request, automatically provisions or logs in the user, and then redirects the user back to your frontend page. Format: {Supabase public URL}/auth/v1/callback | http://10.x.x.x:8443/auth/v1/callback |

2. After registering, open the OAuth application detail page, click "Generate a new client secret" to create a secret, and copy the generated value immediately (**it is shown in full only once**). Also note the Client ID.

> **Note**: Keep the Client Secret safe—leaking it leads to serious security risks. Old secrets that are no longer used should be deleted.

### Step 3: Configure RDS Supabase Auth

1. Open the Supabase application detail page in the RDS management console and choose "Auth" in the left navigation pane.
2. Click "Modify Access Control" in the Access Control module:
   - **Project frontend URL**: the Homepage URL from Step 2
   - **External application URL**: the Supabase public URL obtained in Step 1
   - **Redirect whitelist**: leave it empty
3. Turn on the GitHub switch in the Auth Providers module:
   - **GitHub OAuth App Client ID / Client Secret**: the values obtained in Step 2
   - **Authorization callback URL**: the Authorization callback URL from Step 2

### Step 4: Configure and start the frontend

```bash
# Clone this repository
git clone -b rds-supabase-showcase-github-sso https://github.com/huaweicloud/rds-postgres-AI-demo.git
cd rds-postgres-AI-demo

# Copy the environment variable template and fill in the connection information from Step 1
cp .env.example .env
# VITE_SUPABASE_URL=http://10.x.x.x:8443
# VITE_SUPABASE_ANON_KEY=**********

# Install dependencies (make sure the npm registry is reachable; switch to another registry if unstable or timing out)
npm install

# Start the frontend application
npm run dev
```

After a successful start, the console prints all accessible URLs (default port 5173).

### Step 5: Test GitHub SSO login

1. Open the frontend URL (the Homepage URL) in a local browser: `http://{your-public-IP}:5173`.
2. Click "Sign in with GitHub" to trigger OAuth authentication between GitHub and RDS Supabase. The browser redirects to `https://github.com/login/oauth/authorize?client_id=...`. The authorization consent view appears only once; signing out and signing in again will not show it.
3. Click "Authorize xxx" to complete authorization. The app automatically redirects back to `http://{your-public-IP}:5173/demo` and displays the signed-in user's credentials (avatar, username, user ID, email, Access Token, login method, login time, etc.).
4. (Optional) Open the RDS Supabase Dashboard, choose "Authentication", and you will find a new user registration/login record in the user list, where the provider is GitHub and the email is the one bound to the GitHub account.

## SSO Authentication Flow

1. **Initiate authorization**: after clicking the login button, the app sends an OAuth authorization request to GitHub via Supabase
2. **GitHub authorization**: you are redirected to GitHub and asked to authorize the app to access your account
3. **Callback & token exchange**: GitHub redirects back with a code; Supabase exchanges it for an Access Token
4. **Session established**: Supabase creates the user session, returns to the app, and completes the login

## Project Structure

```
├── .env.example                  # Environment variable template (copy to .env and fill in)
├── .github/                      # CI workflows and Issue/PR templates
├── .gitignore
├── CONTRIBUTING.md               # Contributing guide
├── LICENSE                       # Apache License 2.0
├── README.md / README.en.md      # Project README (Chinese / English)
├── index.html                    # Entry page
├── package.json                  # Dependency configuration
├── package-lock.json
├── public/                       # Static assets
│   └── vite.svg
├── vite.config.js                # Vite build configuration
└── src                           # Core source code
    ├── App.jsx                   # Routing and global layout (with route guards)
    ├── main.jsx                  # Application entry
    ├── index.css                 # Global styles
    ├── components
    │   ├── Dashboard.jsx         # Post-login user dashboard
    │   └── Login.jsx             # GitHub login page
    ├── context
    │   ├── AuthContext.jsx       # Auth context (session management, sign-in/out)
    │   └── LanguageContext.jsx   # Language context (EN/Chinese switch)
    ├── i18n
    │   └── index.js              # EN/Chinese translations
    └── lib
        └── supabaseClient.js     # Supabase client initialization
```

## FAQ

| Symptom | Cause and solution |
| --- | --- |
| Authorization redirect is slow or times out | GitHub servers are deployed overseas. Use an RDS Supabase application in an overseas region and check that the outbound security group rule allows the traffic |
| New GitHub users cannot register or sign in | "Allow new user sign-ups" is not enabled. Turn it on under Auth Configuration > User Sign-up Configuration |
| Client Secret lost | It is shown in full only once. Regenerate it on GitHub and update the RDS Supabase Auth configuration accordingly |
| Frontend fails to start | Port 5173 is occupied. Free the port or change the port in vite.config.js |
| Page reports missing environment variables | .env was not created (copy the template from .env.example) or VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set, or the app was not restarted after editing |
| npm install times out | The npm registry is unreachable or unstable. Switch to another available registry |

## References

- [RDS Supabase AI application: enabling GitHub third-party authentication login (best practice)](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0002.html)
- [RDS Supabase application](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- [Auth configuration management](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)

## License

This project is open-sourced under the [Apache License 2.0](LICENSE).
