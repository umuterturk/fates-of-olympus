# Fates of Olympus — Landing Page

Minimalist, multi-language marketing page for the iPhone game. Built with Vite, React, TypeScript, Tailwind CSS, and React Router.

## Local development

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Features

- **Multi-language support**: English (default), Spanish (Mexico), Turkish
- **Routes**: `/` (home), `/support` (support page)
- **App icon**: iOS app icon (1024×1024 rounded square)
- **Screenshots**: 22 localized gameplay screenshots
- **Performance**: Code-split with React.lazy, lazy-loaded images

### Environment variables (optional)

Copy `.env.example` to `.env.local` to add Google Analytics:

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_GA4_MEASUREMENT_ID` | No | Google Analytics 4 measurement id |

## Multi-language support

The site automatically detects the user's browser language and falls back to English. Supported languages:

- **en** — English (primary/fallback)
- **es-mx** — Spanish (Mexico)
- **tr** — Turkish

Translations live in `src/i18n/translations.ts`.

## Page structure

### Home (`/`)
- **Hero** — App icon, title, tagline, primary CTA
- **Command the Gods** — Horizontal carousel of 12 Olympian cards
- **Face Legendary Foes** — Horizontal carousel of 12 hero/monster cards
- **Experience the Myth** — Localized gameplay screenshots carousel
- **Download** — App Store CTA section
- **Footer** — Copyright + Support link

### Support (`/support`)
- Contact email
- FAQ section
- Back to home link

## Production build

```bash
npm run build
```

Output: `web/dist` (Firebase Hosting `public` in [firebase.json](../firebase.json)).

## Assets

### App Icon
Sourced from iOS project:
```
/Users/umut/Code/fates-of-olympus-ios/ios/fates of olympus/Assets.xcassets/AppIcon.appiconset/AppIconDark.jpg
```

### Screenshots
22 localized screenshots from iOS distribution folder with language codes:
- `-en` (English, 8 screenshots)
- `-sp` (Spanish, 7 screenshots)
- `-tr` (Turkish, 7 screenshots)

### Cards
Card images are sourced from the iOS project:
```
/Users/umut/Code/fates-of-olympus-ios/ios/fates of olympus/Resources/Cards/
```

To update card images, copy from the iOS project or use the resize script:

```bash
./scripts/resize-cards.sh
```

The landing page ships a **curated subset** of 24 cards (12 gods + 12 heroes/monsters). Edit `src/data/cards.ts` to change which cards appear.

## Archived POC

The previous React card-game POC lives in [`../old-web/`](../old-web/) and is not deployed.
