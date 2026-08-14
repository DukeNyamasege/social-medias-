# Duke Social Publisher

A React + Vite + Netlify application designed to authorize and publish to:

- TikTok account 1
- TikTok account 2
- Instagram Professional
- Facebook Page
- YouTube channel

Live site: `https://socialmediam.netlify.app/`

## Current architecture

The app is now connection-first. Nothing is shown as connected until a real OAuth callback succeeds.

1. The frontend calls `/.netlify/functions/oauth-start?slot=...`.
2. The Netlify function checks whether the provider credentials exist.
3. The user is redirected to TikTok, Meta, or Google to authorize the requested scopes.
4. The provider returns to `/.netlify/functions/oauth-callback`.
5. The callback exchanges the authorization code for tokens, verifies the account, encrypts credentials with AES-256-GCM, and stores them in Netlify Blobs.
6. `/.netlify/functions/connections` exposes only safe connection metadata to the frontend. Provider access/refresh tokens are never returned to React.

TikTok 1 and TikTok 2 use the same TikTok developer app but are saved as two separate OAuth account slots.

## Required Netlify environment variables

Copy the names from `.env.example` into **Netlify → Project configuration → Environment variables**. Never put real secrets in GitHub.

```text
TOKEN_ENCRYPTION_KEY
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
META_APP_ID
META_APP_SECRET
META_GRAPH_VERSION
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Register this exact redirect URI with TikTok, Meta, and Google:

```text
https://socialmediam.netlify.app/.netlify/functions/oauth-callback
```

`META_GRAPH_VERSION` is intentionally not hard-coded. Set it to the Graph API version currently selected/recommended in your Meta developer app.

## Requested OAuth permissions

### TikTok

```text
user.info.basic
video.publish
```

`user.info.basic` verifies and displays the authorized TikTok identity. `video.publish` is the Direct Post permission.

### Instagram

This first implementation uses Instagram API with Facebook Login and expects an Instagram Professional account linked to a Facebook Page.

```text
pages_show_list
pages_read_engagement
instagram_basic
instagram_content_publish
```

### Facebook Page

```text
pages_show_list
pages_read_engagement
pages_manage_posts
```

The callback retrieves a Page access token for the Page managed by the authorized Meta user.

### YouTube

```text
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

The readonly scope is used to identify the authorized YouTube channel; the upload scope is used for publishing.

## Provider setup notes

### TikTok

Create an app in TikTok for Developers, enable Login Kit and Content Posting API, register the callback URL, and request/enable the required scopes. Public Direct Post is subject to TikTok's Content Posting API review/audit rules.

### Meta

Create a Meta developer app and configure Facebook Login/Instagram API products. The Instagram account must be Professional for content publishing. Add the callback URL to the app's valid OAuth redirect URIs.

### Google / YouTube

Create a Google Cloud project, enable **YouTube Data API v3**, create OAuth 2.0 credentials of type **Web application**, and add the callback URL as an authorized redirect URI.

## Scheduling

The UI now supports:

- Post now
- This evening
- Tomorrow
- Day after tomorrow
- Custom date and time

The scheduling controls are intentionally not presented as a completed background publisher yet. A scheduled social video must be stored somewhere durable before the browser closes, and then a server-side worker must publish it when the time arrives.

Netlify Scheduled Functions are suitable for polling a persistent queue, but ordinary Netlify Functions have a buffered request limit that is too small for many normal social-video uploads. The next backend stage should therefore add durable video/object storage and then connect a scheduled worker to the platform publishing adapters.

## Important platform limitations

- TikTok unaudited Direct Post clients are restricted by TikTok's audit/public-posting rules.
- YouTube uploads from unverified API projects created after July 28, 2020 are restricted to private visibility until the project passes YouTube's API audit.
- Instagram publishing requires a Professional account.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Netlify builds `dist/` from the `main` branch using `netlify.toml`.
