# Contributing to EZdeck

Thank you for your interest in contributing to EZdeck. This document is your complete guide to getting set up, following our code standards, submitting pull requests, and picking your first issue.

EZdeck welcomes contributors at all experience levels. If this is your first open-source contribution, you are in the right place.

---

## Table of contents

- [Before you start](#before-you-start)
- [Project structure overview](#project-structure-overview)
- [Development setup](#development-setup)
- [Branch naming convention](#branch-naming-convention)
- [Code style rules](#code-style-rules)
- [Commit message format](#commit-message-format)
- [Before submitting a PR](#before-submitting-a-pr)
- [Submitting a pull request](#submitting-a-pull-request)
- [Picking your first issue](#picking-your-first-issue)
- [Getting help](#getting-help)

---

## Before you start

- Read the `README.md` to understand what EZdeck does and how the generator flow works
- Browse open issues on GitHub and look for labels: `good first issue`, `help wanted`
- Check whether the issue you want to work on is already assigned to someone
- Comment on the issue to let the maintainer know you are working on it

**Required tools:**

- Node.js 18 or higher
- npm
- Git
- A code editor (VS Code is recommended)

---

**The most beginner-friendly areas to contribute to are:**

- `lib/templates.ts` — Add new curated template presets
- `lib/themes.ts` — Add or refine themes
- `docs/` — Improve documentation
- `components/` — Fix layout or visual bugs in individual components

## Development setup

**Step 1: Fork and clone**

Click the **Fork** button on the GitHub repository page to create your own copy. Then clone it locally:

```bash
git clone https://github.com/izhan0102/Deckflow.git
cd Deckflow
```

**Step 2: Install dependencies**

```bash
npm install
```

**Step 3: Set up environment variables**

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values. You will need:

- A [Groq API key](https://console.groq.com) — used by the generator and slide editor
- A [Firebase project](https://console.firebase.google.com) — used for auth and usage stats

The `README.md` lists every required variable and where to find it in each service's console.

**Step 4: Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Step 5: Keep your fork up to date**

Before starting any new work, sync your fork with the upstream repository:

```bash
git remote add upstream https://github.com/izhan0102/Deckflow.git
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Branch naming convention

Always create a new branch for your work. Never commit directly to `main`.

Use the format: `type/short-description`

| Type | When to use | Example |
|------|-------------|---------|
| `feat` | Adding new functionality | `feat/chart-type-override` |
| `fix` | Fixing a broken behaviour | `fix/export-spinner-hang` |
| `docs` | Documentation changes only | `docs/update-setup-guide` |
| `style` | Tailwind / CSS visual changes, no logic change | `style/improve-slide-rail-spacing` |
| `refactor` | Restructures code without changing behaviour | `refactor/groq-parser` |
| `chore` | Dependencies, config, or tooling | `chore/update-pptxgenjs` |
| `template` | Adding or updating a slide template preset | `template/add-investor-deck` |

Create your branch:

```bash
git checkout -b feat/your-feature-name
```

---

## Code style rules

### TypeScript

- Use TypeScript for everything. No plain `.js` files in `app/`, `components/`, or `lib/`
- No `any` — if you must use it, add a comment explaining why
- Use `camelCase` for variables and functions, `PascalCase` for types, interfaces, and components
- Every new function or custom hook should have a JSDoc comment describing what it does
- Do not leave `console.log()` or debug statements in submitted code
- Keep functions and components focused on one responsibility — if a component is growing large, consider splitting it

Example of acceptable TypeScript style:

```typescript
/**
 * Returns the display label for a slide layout.
 * Falls back to the raw layout string if no label is defined.
 */
function getLayoutLabel(layout: SlideLayout): string {
  const labels: Record<SlideLayout, string> = {
    "title-hero": "Title",
    "bullets": "Bullets",
    // ...
  };
  return labels[layout] ?? layout;
}
```

### Tailwind

- Use Tailwind utility classes for all styling — do not add one-off CSS unless Tailwind genuinely cannot express it
- If you find yourself repeating the same set of utilities across multiple elements, extract a shared component instead
- Do not use inline `style={{}}` attributes for anything Tailwind can handle

### React components

- Use functional components with hooks — no class components
- Keep `useEffect` dependencies accurate — do not suppress the exhaustive-deps lint rule without a comment
- Avoid prop drilling more than two levels deep — use context or lift state

### API routes

- API routes in `app/api/` are thin proxies. They hold secrets, call Groq or Iconify, and return results. Do not move business logic into them, and do not move secret-dependent work out of them.
- Every route should return a typed `NextResponse.json()` with a meaningful HTTP status code on both success and error paths

### Adding a theme

Themes are defined in `lib/themes.ts` as entries in the `PRESET_THEMES` array. Each entry must include all fields defined by the `Theme` type: `id`, `name`, `bg`, `fg`, `accent`, `muted`, and `font`. The `id` must be unique across all existing themes.

### Adding a template

Templates are defined in `lib/templates.ts`. Each template is a curated combination of theme, font, graphic style, per-layout variant defaults, and a sample prompt. A new template must render correctly across at least three different themes before submitting.

---

## Commit message format

Use the same `type: description` format as branch names for commit messages.

```
feat: add chart type override to designer panel
fix: resolve export spinner hanging on large decks
docs: add architecture section to CONTRIBUTING.md
style: tighten slide rail thumbnail spacing
refactor: simplify groq response parser
chore: update pptxgenjs to 3.12.0
template: add investor deck preset
```

**Rules:**

- Use the present tense — "add feature" not "added feature"
- Keep the first line under 72 characters
- Reference issue numbers when relevant: `fix: resolve export spinner hang (#42)`
- If more context is needed, leave a blank line after the first line and add a paragraph below

---

## Before submitting a PR

Run all three of these commands locally. All must complete with zero errors before you open a PR — reviewers will run them and will not merge if any fail.

```bash
npm run build        # production build — zero errors
npx tsc --noEmit     # TypeScript type-check — zero errors
npm run lint         # ESLint — zero errors or warnings
```

Also check:

- You have tested the change in your browser at `localhost:3000`
- If you changed `SlideCanvas`, you tested the editor, thumbnail rail, presenter mode, and PDF export
- If you changed `lib/types.ts`, all consumers (editor, export route, share viewer) handle the new or changed field gracefully
- If you added a template, it renders correctly across at least three themes
- No `.env.local` values or secrets are committed

---

## Submitting a pull request

1. Push your branch to your fork:

```bash
git push origin your-branch-name
```

2. Go to your fork on GitHub and click **Compare and pull request**
3. Fill in the PR template completely — all required sections must be filled in
4. A maintainer will review within a few days. Address any feedback by pushing new commits to the same branch — do not open a new PR

---

## Picking your first issue

Issues are labelled to help you find the right starting point:

| Label | Meaning |
|-------|---------|
| `good first issue` | Small, self-contained tasks ideal for first-time contributors |
| `help wanted` | Tasks where maintainer input is welcome |
| `bug` | Something is broken and needs fixing |
| `enhancement` | A new feature or improvement to an existing feature |
| `documentation` | Writing or improving docs, comments, or guides |
| `template` | Adding a new slide template preset |

## Getting help

- Open a GitHub Discussion for questions about the codebase
- Comment directly on the issue you are working on
- Tag the maintainer in your PR if you are stuck on review feedback

No question is too basic.

---

## License

EZdeck is released under the [MIT License](LICENSE). By contributing, you agree that your changes will be distributed under the same license.