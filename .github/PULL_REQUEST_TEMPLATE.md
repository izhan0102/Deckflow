## Summary [required]

<!-- One or two sentences describing what this PR does and why. -->

## Related issue [required]

Closes #

## Type of change [required]

- [ ] Bug fix — resolves a broken behaviour
- [ ] Feature — adds new functionality
- [ ] Template — adds or updates a slide template in `lib/templates.ts`
- [ ] Documentation — updates docs, README, or code comments only
- [ ] Style — CSS / Tailwind visual changes only, no logic change
- [ ] Refactor — restructures code without changing behaviour
- [ ] Chore — dependency updates, config, tooling

## What was changed [required]

| File | Change made |
|------|-------------|
| `components/SlideCanvas.tsx` | e.g. Fixed text overflow on two-column layout |
| `lib/types.ts` | e.g. Added optional `caption` field to `SlideElement` |

<!-- Add or remove rows as needed. -->

## How to test this PR [required]

1. Checkout this branch: `git checkout <branch-name>`
2. Install dependencies: `npm install`
3. Copy env if you haven't already: `cp .env.local.example .env.local` and fill in credentials
4. Run the dev server: `npm run dev` — open http://localhost:3000
5. <!-- Describe the specific steps to verify the change, e.g.: -->
   - Go to `/app`, generate a deck with the prompt "…"
   - Click **Export → PPTX** and confirm the file downloads
   - Open the file in PowerPoint / LibreOffice and check slide 3

## Verification commands [required]

Run these locally before submitting. All three must pass cleanly.

```bash
npm run build          # production build — zero errors
npx tsc --noEmit       # TypeScript type-check — zero errors
npm run lint           # ESLint — zero errors or warnings
```

Expected output:
```
# npm run build
✓ Compiled successfully

# npx tsc --noEmit
(no output)

# npm run lint
✓ No ESLint warnings or errors
```

## Actual output [required]

```
paste your build / lint output here
```

## Screenshots (if UI change)

| Before | After |
|--------|-------|
| <!-- screenshot --> | <!-- screenshot --> |

<!-- Delete this section if there is no visual change. -->

## Self-review checklist [required]

- [ ] I have read `CONTRIBUTING.md` and followed all guidelines
- [ ] My branch name follows the convention: `feat/`, `fix/`, `docs/`, `style/`, `refactor/`, `chore/`
- [ ] `npm run build` completes with zero errors
- [ ] `npx tsc --noEmit` completes with zero errors
- [ ] `npm run lint` completes with zero errors or warnings
- [ ] I have not introduced any `console.log()` or debug statements
- [ ] Every new function or hook has a JSDoc comment describing what it does
- [ ] I have not modified files outside the scope of the linked issue
- [ ] If I changed `SlideCanvas`, I tested the editor, thumbnail rail, presenter mode, and PDF export
- [ ] If I changed `lib/types.ts`, all consumers (editor, export, share viewer) handle the new/changed field
- [ ] If I added a template, it renders correctly across at least three different themes
- [ ] If I changed the UI, I tested it at 375 px (mobile) and 1280 px (desktop)
- [ ] No secrets or `.env.local` values are committed

## Notes for reviewer

<!-- Anything the reviewer should know : trade-offs made, known limitations, follow-up issues to open, etc. Delete if not needed. -->