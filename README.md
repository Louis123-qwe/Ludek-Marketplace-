# Ludek Market

The campus marketplace for UNICROSS, Okuku Campus.

## Structure

| Folder | What it is | Runs on |
|---|---|---|
| `apps/web` | Single-page app in JavaScript, built with Vite | Vercel |
| `apps/api` | REST API in Rust (axum) with Postgres | Render and Neon |

Firebase is used for sign-in only. Photos are stored on Cloudinary.

## Run it locally

1. Start the API:
   ```bash
   cd apps/api
   cp .env.example .env
   cargo run
   ```
   Open `.env` first and add your Neon connection string and your own email in `ADMIN_EMAILS`.
2. Start the web app from the repo root:
   ```bash
   npm install
   cp apps/web/.env.example apps/web/.env
   npm run dev:web
   ```
   Add your Firebase values to `apps/web/.env`.

## Deploy

**API on Render:** create a Blueprint from this repo. It reads `render.yaml`. Then set `DATABASE_URL`, `ADMIN_EMAILS` and `CORS_ORIGINS` in the Render dashboard. Point UptimeRobot at `/health`.

**Web on Vercel:** import the repo and set the Root Directory to `apps/web`. Add the `VITE_` values from `apps/web/.env.example` as environment variables. Add your Vercel domain to Firebase under Authentication, Settings, Authorized domains.

## SEO

Every public page sets its own title, description, canonical link, Open Graph and Twitter tags. Product pages carry Product structured data. `/sitemap.xml` is generated from live listings. Search engines and link previews get a pre-rendered page for each product. `robots.txt` blocks private pages.

## Security

See `SECURITY.md`.
