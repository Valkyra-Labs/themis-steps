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

The engine is [themis-algebra](https://github.com/Valkyra-Labs/themis-algebra)
(Rust, exact arithmetic, compiled to WebAssembly); the interface is React
and TypeScript on the [Stoa](https://github.com/Valkyra-Labs/stoa-system)
design system, in English and Arabic (right to left, with maths kept left
to right). Everything runs in the browser.

## Development

```bash
pnpm install && pnpm dev
```

```bash
pnpm test && pnpm e2e
```

## License

MIT OR Apache-2.0, at your option.
