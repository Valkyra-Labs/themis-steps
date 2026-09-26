# Measurements

Host: Apple M4 Pro (12 CPU cores), 24 GB, macOS 26.6; the Chromium-based
preview pane of the development environment. Engine: themis-algebra
`99a98db` compiled to WebAssembly with opt-level "z" and LTO (160 KB,
68 KB gzipped; 69 KB as served by the Vite build).

## Check latency (2026-09-26)

Nine steps typed in the app, from a linear move to a quartic with a
rational factor, each timed around the engine call in the page:
0.3-1.7 ms per step (median 0.7 ms). Checks run on the UI thread.

## Correctness

The engine's corpus (themis-algebra `tests/corpus.rs`) and this app's
end-to-end tests: typed steps get the right verdict and the verdict is
announced to screen readers; the worked examples with a mistake are
flagged at the right line (4 of 4); the audit flags 3 of 12 stated
answers (a dropped root, an extraneous root at an excluded point, a
dropped zero) and passes the other 9; the Arabic interface is right to
left with maths left to right; axe finds no serious or critical
violations in English or Arabic. 6 of 6 end-to-end tests pass.
