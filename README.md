# Ludek Marketplace — CRUTECH Okuku Campus
## Phase 1: PWA Foundation ✅

---

### Project Structure

```
ludek-marketplace/
├── index.html              ← Landing page (Phase 1)
├── auth.html               ← Auth placeholder (Phase 2)
├── marketplace.html        ← Marketplace placeholder (Phase 3)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker (offline + caching)
│
├── css/
│   ├── main.css            ← Design system, global styles
│   └── landing.css         ← Landing page specific styles
│
├── js/
│   └── app.js              ← Core JS: SW registration, nav, PWA install
│
├── firebase/
│   └── config.js           ← Firebase config (fill in your credentials)
│
├── assets/
│   ├── favicon.svg         ← SVG favicon
│   ├── icon-192.png        ← PWA icon (generate these!)
│   └── icon-512.png        ← PWA icon (generate these!)
│
├── seller/
│   └── dashboard.html      ← Placeholder (Phase 4)
│
└── admin/                  ← Placeholder (Phase 7)
```

---

### Design Tokens (Theme)
- **Forest Green:** `#2D5016` (primary brand, backgrounds)
- **Burnt Orange:** `#D4520A` (CTA, accents, highlights)
- **Warm Milk:** `#FAF7F0` (page background)

All colors are CSS custom properties in `css/main.css` under `:root`.

---

### How to Run Locally

1. **Serve with a local dev server** (required for PWA + service worker):
   ```bash
   # Using Node.js + npx
   npx serve .

   # OR Python
   python3 -m http.server 8000
   ```

2. Open `http://localhost:3000` (or the port shown).

3. The PWA install banner will appear after ~3 seconds on first visit.

---

### Generate PWA Icons

Use [realfavicongenerator.net](https://realfavicongenerator.net) or:

```bash
# Using ImageMagick (if installed)
convert favicon.svg -resize 192x192 assets/icon-192.png
convert favicon.svg -resize 512x512 assets/icon-512.png
```

Place the output PNG files in the `/assets/` folder.

---

### Firebase Setup (Phase 2)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project: `ludek-marketplace`
3. Enable **Authentication** (Email/Password)
4. Create **Firestore Database**
5. Copy your config to `firebase/config.js`

---

### Phase Progress

| Phase | Description              | Status    |
|-------|--------------------------|-----------|
| 1     | PWA Foundation           | ✅ Done   |
| 2     | Auth System (Firebase)   | ⏳ Next   |
| 3     | Marketplace Feed         | 🔜 Soon   |
| 4     | Seller Dashboard         | 🔜 Soon   |
| 5     | Product System           | 🔜 Soon   |
| 6     | Seller Profile           | 🔜 Soon   |
| 7     | Admin Dashboard          | 🔜 Soon   |
| 8     | PWA Finalization         | 🔜 Soon   |

---

### Deployment (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Set `public` directory to `.` (project root).
