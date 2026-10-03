# Themis Steps

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

## License

MIT OR Apache-2.0, at your option.
