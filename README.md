# Themis Steps

[![CI](https://github.com/Valkyra-Labs/themis-steps/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Valkyra-Labs/themis-steps/actions/workflows/ci.yml)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](#license)
[![Unit tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/unit-tests.json)](#badges)
[![e2e](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/e2e.json)](#badges)
[![axe](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/axe.json)](#badges)
[![Lighthouse accessibility](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/lighthouse-accessibility.json)](#badges)
[![Lighthouse best practices](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/lighthouse-best-practices.json)](#badges)
[![Lighthouse SEO](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/lighthouse-seo.json)](#badges)
[![Bundle gzip](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Valkyra-Labs/themis-steps/badges/bundle-size.json)](#badges)

The test, axe, Lighthouse and size badges are measured and published by
CI from `main`; what each one counts is under [Badges](#badges).

Write algebra line by line; each line is checked against the previous
one by what it means, not by how it is written. A wrong step is named
exactly: the roots it loses or gains, and any change of domain.

- **Check your working**: type a line, press Enter, read the verdict.
- **Worked examples**: solutions checked line by line; the ones with a
  classic mistake (dividing by the unknown, dropping a root in the last
  line, moving a term without its sign, multiplying by an expression that
  can be zero) are caught at the right line.
- **Audit exercises**: a set of generated exercises with stated answers,
  each answer checked against the exact solutions of its equation, the
  way a content pipeline could gate what it publishes.

Removing a line or starting over can be undone; the working is kept when
you switch tabs; and while the engine loads the page says so, with a
retry if it fails.

Every verdict is explained in the interface's language: the app writes
the explanation from the engine's structured result (the roots lost or
gained, a change of domain, two unequal expressions, or why a line could
not be read), so the Arabic interface is Arabic throughout, maths aside.
Answers can be typed with "أو" or the Arabic comma between alternatives.
The header switches between light and dark (following the system until
one is chosen) and between English and Arabic; both choices are kept in
the link (`?theme=`, `?lang=`), and the theme also for the next visit.

The engine is [themis-algebra](https://github.com/Valkyra-Labs/themis-algebra)
(Rust, exact arithmetic, compiled to WebAssembly); the interface is React
and TypeScript on the [Stoa](https://github.com/Valkyra-Labs/stoa-system)
design system, in English and Arabic (right to left, with maths kept left
to right). Everything runs in the browser.

## Development

Stoa and the engine are linked from sibling checkouts: clone
[stoa-system](https://github.com/Valkyra-Labs/stoa-system) and build it
(`pnpm build`), and clone themis-algebra and build its WebAssembly
package into `pkg/` with wasm-pack, next to this repository.

```bash
pnpm install && pnpm dev
```

```bash
pnpm test && pnpm e2e
```

`pnpm e2e` drives the dev server on 5175 and reuses one already running
there. `E2E_PORT` moves it to another port, and `E2E_PREVIEW=1` tests the
production build (after `pnpm build`) through `vite preview`, as CI does:

```bash
pnpm build && E2E_PREVIEW=1 E2E_PORT=4181 pnpm e2e
```

### Badges

CI checks out this repository, stoa-system and themis-algebra side by
side, builds the engine with wasm-pack and Stoa, then builds and tests
the app. Each green run on `main` publishes the dynamic badges to the
`badges` branch, as JSON that img.shields.io reads; `scripts/badges.mjs`
builds them from that run's own output and stops, publishing nothing,
when a value cannot be read.

- Unit tests: Vitest tests passed (`pnpm test`).
- e2e: Playwright tests passed in Chromium against `vite preview` of the
  build (`e2e/`).
- axe: axe-core 4.13.0 in the e2e, on each of the three tabs in English
  and Arabic, light and dark; a serious or critical violation fails the
  run.
- Lighthouse: Lighthouse 12 accessibility, best practices and SEO scores
  for the home page served by `vite preview`, the lower of the desktop
  and mobile runs. Performance is not shown: on a shared CI runner it
  measures the runner.
- Bundle gzip: every JavaScript and CSS file in `dist/`, gzip level 9,
  summed. The engine's WebAssembly and the fonts are not included.

## License

MIT OR Apache-2.0, at your option.
