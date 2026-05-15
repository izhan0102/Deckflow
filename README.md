# DeckFlow

AI presentation builder. Type a short prompt, pick a theme, get an editable deck in seconds. Drag text boxes, edit them inline, swap colors, ask the chat to rewrite a slide, drop in your own images, and export to PowerPoint or PDF.

Live preview, full-screen presenter mode, and slide reorder all included.

## Features

- Three-step generator: prompt -> theme -> deck
- Seven layouts: title hero, bullets, table, two-column, quote, section, references, closing
- Density slider so you can choose how dense each slide should be
- Eight preset themes plus a custom color and font picker
- Per-slide AI chat that knows the deck topic, theme colors, and all slide titles
- Drag-and-drop text boxes with PowerPoint-style font sizes (10, 12, 14, 16, ...)
- Inline text editing on every box
- Image upload with free positioning and resize
- Corner annotations the AI can place via natural language ("add team leader at bottom left in small font")
- Optional references slide auto-inserted before the closing
- Slide reorder, duplicate, insert, and delete from the thumbnail rail
- Full-screen Present mode with PowerPoint shortcuts and smooth fades
- Real .pptx and .pdf export, both pixel-mirroring the on-screen design
- Firebase auth (email and Google) with stats events written to Realtime DB
- Multi-key Groq fallback so a rate limit on one key auto-switches to another

## Stack

- Next.js 14 with the App Router
- TypeScript and Tailwind
- Groq SDK for inference (model: openai/gpt-oss-120b)
- pptxgenjs for PowerPoint export
- jsPDF and html2canvas for PDF export
- Firebase Auth and Realtime Database
- Lucide for icons

## Setup

```bash
git clone https://github.com/izhan0102/Deckflow.git
cd Deckflow
npm install
cp .env.local.example .env.local
# fill in the values, then
npm run dev
```

Open http://localhost:3000.

### Required env vars

```
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_FALLBACK=optional_second_key

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
```

The Groq key is server-only. The Firebase NEXT_PUBLIC_ values are client-side and public by Google's design, protected by Auth authorized domains and Realtime Database security rules.

## Routes

- `/` landing page with feature tour and live counters
- `/auth` sign in / sign up (email and Google)
- `/app` the generator and editor (requires sign-in)
- `/privacy`, `/terms`, `/refund`, `/shipping`, `/contact` legal pages

## Project structure

```
app/
  page.tsx              landing
  app/page.tsx          generator and editor
  auth/page.tsx         login / signup
  api/
    generate/           creates a deck from a prompt
    edit-slide/         applies a single-slide AI patch
    export/             builds the .pptx file
components/             SlideCanvas, DeckPreview, Presenter, etc.
lib/
  groq.ts               deck generation
  groqClient.ts         multi-key Groq client with fallback
  layoutMath.ts         adaptive font sizes shared by preview and export
  pdfExport.ts          client-side PDF builder
  firebase.ts           Firebase initialization
  auth.ts               sign-in helpers
  stats.ts              event tracking
  legal.ts              single source of truth for legal copy
```

## Notes


- LinkedIn: https://www.linkedin.com/in/muhammad-izhan-a404752a6/
- GitHub: https://github.com/izhan0102

## License

All rights reserved. The code is published for transparency and portfolio purposes; please do not redistribute or build a competing product without permission.
