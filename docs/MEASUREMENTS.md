# Measurements

Host: Apple M4 Pro (12 CPU cores), 24 GB, macOS 26.6; a Chromium-based
browser (version not recorded). Engine: themis-algebra
`99a98db` compiled to WebAssembly with opt-level "z" and LTO (160 KB,
68 KB gzipped; 69 KB as served by the Vite build).

## Check latency (2026-09-26, themis-steps `6b28008`)

Nine steps typed in the app, from a linear move to a quartic with a
rational factor, each timed around the engine call in the page:
0.3-1.7 ms per step (median 0.7 ms). Checks run on the UI thread.

## Correctness (themis-steps `3f718f8`, Playwright 1.63.0, Chromium)

The engine's corpus (themis-algebra `tests/corpus.rs`), this app's unit
tests and its end-to-end tests.

Unit tests (19 of 19 pass, Vitest, the engine's WebAssembly loaded in
Node): the English and Arabic tables have the same keys with the same
kinds of value; on 29 steps covering every verdict, kind of root, change
of domain and parse error the engine reaches from a typed line, the
English explanation equals the engine's own sentence, and the Arabic
has no Latin word outside maths; tokens the engine names in their debug
form are shown as the symbol; the Arabic agrees with the number of
roots; a stated answer is explained against its equation; answers typed
with "أو", the Arabic comma or semicolon get the same verdict as the
English ones; plus the engine loading, the undo of the working and the
display form of a line.

End-to-end tests (24 of 24 pass): typed steps get the right verdict and
the verdict is announced to screen readers; the worked examples with a
mistake are flagged at the right line (4 of 4); the audit flags 3 of 12
stated answers (a dropped root, an extraneous root at an excluded point,
a dropped zero) and passes the other 9; the Arabic interface is right to
left with maths left to right, explains each verdict (typed, and in the
audit) in Arabic with its maths isolated, and reads answers typed with
"أو" and the Arabic comma; in the Arabic interface no text node (live
regions included), aria-label, title, placeholder or alt attribute, nor
the page title, has Latin letters outside maths, on each tab, with
correct, wrong and unreadable lines and an undo notice shown (maths:
text inside a `<bdi>`, holding no Latin word, or between Unicode
isolates; excluded: the language codes EN and AR), and nothing in it is
marked as English; Remove last line and Start over can be undone, in
both languages, with focus kept; the working survives a change of tab;
the chosen language survives a reload; the theme follows the system
until one is chosen, and a chosen theme survives a reload and the next
visit, a link's theme winning, and works with storage blocked; arrow
keys in the tabs follow the direction; every weight of IBM Plex Sans
Arabic the interface draws is loaded; the engine's loading state is
announced and a failed load can be retried; axe finds no serious or
critical violations on each tab with a wrong step shown, in English and
Arabic each in the light and the dark theme, and with the undo notice
and the engine-failure alert shown.
