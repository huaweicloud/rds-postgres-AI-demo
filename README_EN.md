# RDS Supabase Email Authentication Demo

English | [中文](./README.md)

A demo email authentication application built on the AI application development platform (RDS Supabase) of Huawei Cloud RDS for PostgreSQL. It demonstrates the complete email authentication workflow with RDS Supabase: signup with email confirmation, password sign-in, Magic Link passwordless login, password reset, email change, and re-authentication.

## Features

- Email signup & confirmation: real-time password strength indicator; confirmation email sent after signup
- Email & password sign-in: redirects to the user dashboard after login
- Magic Link passwordless login: a sign-in link is emailed; clicking it signs the user in
- Password reset: both request mode (forgot password, signed out) and inline mode (from the dashboard)
- Email change: confirmation link sent to the new address; pending state shown on the dashboard
- Re-authentication: triggers a reauthentication email
- User dashboard: avatar, user ID, email, registration time, and last sign-in time
- Chinese/English toggle: UI copy and error messages in both languages

## Tech Stack

- [React](https://react.dev/) 18
- [Vite](https://vitejs.dev/) 5
- [@supabase/supabase-js](https://github.com/supabase/supabase-js)

## Project Structure

```text
.
├── .env                    # Supabase environment variables (URL / Anon Key)
├── .env.example            # Environment variable template
├── index.html              # App entry page
├── package.json            # Dependencies (React18 + Vite5 + Supabase)
├── vite.config.js          # Vite build configuration
└── src                     # Core source directory
    ├── App.jsx             # Root component: routes by auth state, with language toggle
    ├── main.jsx            # React app mount point
    ├── index.css           # Global styles
    ├── components          # UI components
    │   ├── AuthForm.jsx        # Sign-in / sign-up form
    │   ├── ChangeEmail.jsx     # Change email component
    │   ├── Dashboard.jsx       # Post-login user panel
    │   ├── Message.jsx         # Generic message banner
    │   ├── ResetPassword.jsx   # Password reset (request / recovery modes)
    │   └── ResetPasswordInline.jsx  # Inline password reset
    ├── context             # React state management
    │   ├── AuthContext.jsx     # Auth state (Supabase session)
    │   └── LanguageContext.jsx # Chinese/English language toggle
    ├── i18n                # Internationalization copy
    │   ├── en.js               # English strings
    │   └── zh.js               # Chinese strings
    └── lib                 # Utilities
        ├── errors.js           # Error code to user-facing message mapping
        └── supabase.js         # Supabase client initialization
```

## Getting Started

### Prerequisites

- A running RDS Supabase instance. See [RDS Supabase (user guide)](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_00.html)
- An EIP bound to the instance and security group outbound rules that allow access to your SMTP server (address/port). See [Binding and Unbinding an EIP](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_19.html)
- Auth configuration completed in the RDS management console (see [Backend Configuration](#backend-configuration))

### Backend Configuration

1. Log in to the [RDS management console](https://console.huaweicloud.com/rds/#/rds/management/list) and open the "Auth Configuration" page of your Supabase application.
2. Under "Identity Providers", configure the Email (SMTP) provider:

| Parameter | Description | Example |
| --- | --- | --- |
| Enable external email login | Enables email signup | On |
| SMTP host | SMTP server address (IPv4 or public domain) | 192.168.1.1 |
| SMTP port | SSL-encrypted port recommended | 465 |
| SMTP username | Email address | test_mail@spe.com |
| SMTP password | Email authorization code (not the login password) | - |
| Admin email | Usually the same as the SMTP username | test_mail@spe.com |
| Sender name | From-name shown to recipients | RDS Supabase |
| Auto-confirm email | Recommended OFF for production | Off |
| Rate limit (seconds) | Minimum interval between emails per user/IP | 60 |

3. Under "Access Control", configure redirect settings:

| Parameter | Description | Example |
| --- | --- | --- |
| Site URL | Frontend app address; target of email links and OAuth redirects | http://10.10.10.20:8080 |
| External URL | Full external URL of the Supabase app, no trailing `/` | http://10.10.10.10:8443 |
| Redirect whitelist | Valid targets for the redirect_to parameter, comma-separated, up to 10 | http://10.10.10.11:8080 |

> Note: modifying Auth configuration restarts the service; perform changes during off-peak hours. Auth settings must only be managed in the AI application development platform console — do not modify them in the Supabase Dashboard, or metadata inconsistencies may break authentication.

### Configure Environment Variables

Copy `.env.example` to `.env` and fill in your RDS Supabase connection info:

```bash
# Public URL of your RDS Supabase instance
VITE_SUPABASE_URL=your-supabase-url
# Anon Key of your RDS Supabase instance
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Install and Run

```bash
npm install
npm run dev
```

The dev server listens on `0.0.0.0:5173` by default. Open `http://<your-ip>:5173` in a browser.

### Production Build

```bash
npm run build
npm run preview
```

## Verification Walkthrough

Using a Foxmail enterprise mailbox (`test_mail@spe.com`) as an example:

1. **Sign up**: switch to the "Sign Up" tab, enter an email and password (a strength indicator is shown live), create the account, then check the inbox for the confirmation email.
2. **Confirm email**: open the confirmation email from RDS Supabase and click "Confirm your email address"; the browser redirects back to the app.
3. **Sign in**: enter the email and password on the "Sign In" tab; the dashboard shows the avatar, user ID, registration time, and last sign-in time.
4. **Magic Link**: sign out, switch to the "Magic Link" tab, enter the registered email, then click "Log In" in the email to be signed in automatically.
5. **Reset password**: while signed out, click "Forgot password" and send a reset link; click "Reset Password" in the email and set a new password. It can also be reset inline from the dashboard.
6. **Change email**: on the dashboard, click "Change Email", enter the new address and send the confirmation; the pending state is shown until the link in the new mailbox is clicked.
7. **Re-authenticate**: click "Re-authenticate" on the dashboard and complete verification via the emailed code.

## Custom Email Templates (Optional)

RDS Supabase ships with built-in English email templates. Two customization options are supported:

- **Option 1: remote templates via URL** — upload custom HTML templates to a public Supabase Storage bucket and fill in the template URL (`http(s)://<app-address>/storage/v1/object/public/<bucket>/<file>`) under "Auth Configuration > Email".
- **Option 2: template content in the console (recommended)** — paste HTML directly into each template input; no Storage needed. When both are configured, this option takes precedence.

Supported template types and placeholders:

| Template type | Purpose | Placeholders |
| --- | --- | --- |
| confirmation | Signup confirmation email | `{{ .ConfirmationURL }}`, `{{ .Token }}` |
| invite | User invitation email | `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}` |
| recovery | Password reset email | `{{ .ConfirmationURL }}`, `{{ .Token }}` |
| email_change | Email change confirmation | `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| magic_link | Magic Link login email | `{{ .ConfirmationURL }}`, `{{ .SiteURL }}` |
| reauthentication | Re-authentication email | `{{ .Token }}` |

Links and codes are valid for 1 hour by default. See [Custom Email Templates](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html) for complete samples and steps.

## References

- [RDS Supabase: connect to an SMTP server and enable email authentication (best practice)](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0001.html)
- [RDS Supabase email authentication demo source code guide (best practice)](https://support.huaweicloud.com/bestpractice-rds-pg/rds_pg_ai_0003.html)
- [Auth configuration management (user guide)](https://support.huaweicloud.com/usermanual-rds-pg/rds_supabase_20.html)
- [Supabase Email Templates (official docs)](https://supabase.com/docs/guides/auth/auth-email-templates)

## License

[Apache-2.0](./LICENSE)
