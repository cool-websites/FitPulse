# FitPulse — AI Fitness PWA

A fully featured, iOS-ready Progressive Web App (PWA) for fitness tracking. Built with vanilla HTML, CSS, and JavaScript. AI coaching powered by Claude.

## Features

- **Workout Tracker** — log exercises with a weekly calendar view
- **Nutrition Logger** — calorie ring, macro tracking, meal log
- **Habit Tracker** — streaks, 7-day dots, multi-habit grid
- **Run Tracker** — live timer with distance, pace, and calorie tracking
- **AI Coach** — Claude-powered coaching on every screen
- **PWA** — installable, offline-capable, full-screen on iOS & Android
- **Locked PRO features** — unlock automatically when user adds to Home Screen

---

## Project Structure

```
fitpulse/
├── index.html          # Main app shell
├── style.css           # All styles
├── app.js              # App logic + AI integration
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline cache)
├── generate_icons.py   # Script to generate icons (run once)
├── icons/              # All PWA icons + iOS splash screens
│   ├── icon-192.png
│   ├── icon-512.png
│   └── ...
└── screenshots/        # Optional: app store screenshots
```

---

## Deployment to GitHub Pages

### 1. Create a GitHub repository

```bash
git init
git add .
git commit -m "Initial commit: FitPulse PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fitpulse.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select `main` branch and `/ (root)` folder
3. Click **Save**
4. Your app will be live at: `https://YOUR_USERNAME.github.io/fitpulse/`

> **Important:** Update `"start_url"` and `"scope"` in `manifest.json` to match your GitHub Pages path:
> ```json
> "start_url": "/fitpulse/",
> "scope": "/fitpulse/"
> ```

### 3. Add your Anthropic API key

**For development** (quick test only):
Open `app.js` and replace `YOUR_API_KEY_HERE`:
```js
'x-api-key': 'sk-ant-...',
```

**For production** (recommended):
Never expose your API key in client-side code. Use a backend proxy instead.

---

## API Key — Backend Proxy (Recommended)

Create a simple Cloudflare Worker proxy to keep your key secret:

```js
// Cloudflare Worker — proxy.js
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://YOUR_USERNAME.github.io',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const body = await request.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': YOUR_SECRET_API_KEY,   // Set in Cloudflare env vars
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://YOUR_USERNAME.github.io',
      }
    });
  }
};
```

Then in `app.js`, change `CLAUDE_API_URL` to your Worker URL:
```js
const CLAUDE_API_URL = 'https://your-worker.your-subdomain.workers.dev';
```

---

## Generating Icons

Icons are pre-generated in the `icons/` folder. To regenerate or customize:

```bash
pip install Pillow
python3 generate_icons.py
```

For production, replace generated icons with your own branded artwork. Required sizes: 16, 32, 72, 96, 128, 144, 152, 180, 192, 512px.

---

## iOS "Add to Home Screen"

The app automatically prompts iOS Safari users to add it to their Home Screen after 3.5 seconds. Once installed:
- Runs full-screen (no browser chrome)
- Works offline via service worker cache
- All 5 PRO features unlock automatically
- App icon appears on the home screen

On Android/Chrome, the native install banner appears automatically.

---

## Customization

| File | What to change |
|------|---------------|
| `style.css` | Colors (`--accent`, `--bg`, etc.), fonts, layout |
| `app.js` | AI system prompts, fitness logic, goals |
| `manifest.json` | App name, theme color, shortcuts |
| `index.html` | Demo data (workouts, meals, habits) |
| `icons/` | Replace with your own branded icons |

---

## Tech Stack

- **HTML/CSS/JS** — no framework, no build step required
- **Claude API** — `claude-sonnet-4-20250514` for AI coaching
- **Service Worker** — offline caching with cache-first strategy
- **Web App Manifest** — PWA installability on iOS & Android

---

## License

MIT — feel free to use, modify, and ship.
