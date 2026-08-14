# Duke Social Publisher — UI Draft 1

A React + Vite first-draft publishing card for sending one video to:

- TikTok account 1
- TikTok account 2
- Instagram
- Facebook
- YouTube

## What works in this draft

- Responsive premium dashboard card
- Video picker + drag/drop
- Video file validation
- Caption input
- Select/deselect all five destinations independently
- Connected-account presentation
- Publish button validation

## Not connected yet

The Publish Everywhere button does not make API calls yet. Live publishing will be implemented after OAuth/app credentials are configured for TikTok, Meta, and Google/YouTube.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite `dist/` folder can be deployed to Netlify.
