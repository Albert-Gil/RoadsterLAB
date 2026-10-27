# Self-hosted fonts

RoadsterLAB ships its own text faces so every browser renders the same type,
instead of falling back to Arial when Inter is not installed.

| File | Family | Source | License |
| --- | --- | --- | --- |
| `inter-latin-wght-normal.woff2` | RL Inter (variable weight) | `@fontsource-variable/inter@5.3.0` | OFL-1.1 (`LICENSE-Inter.txt`) |
| `inter-latin-ext-wght-normal.woff2` | RL Inter, Latin Extended | same | OFL-1.1 |
| `inter-greek-wght-normal.woff2` | RL Inter, Greek (μ, Δ, θ, ω) | same | OFL-1.1 |
| `jetbrains-mono-latin-400-normal.woff2` | RL Mono | `@fontsource/jetbrains-mono@5.3.0` | OFL-1.1 (`LICENSE-JetBrainsMono.txt`) |
| `jetbrains-mono-latin-ext-400-normal.woff2` | RL Mono, Latin Extended | same | OFL-1.1 |
| `jetbrains-mono-greek-400-normal.woff2` | RL Mono, Greek | same | OFL-1.1 |

`unicode-range` in `src/style.css` means browsers download the extended and Greek
files only when a page actually uses those characters. `scripts/build.mjs` copies
the files to `dist/assets/fonts/` and embeds them as data URLs in the standalone
HTML. Files are unmodified from the npm packages (SHA-256 below).

```
3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62  inter-latin-wght-normal.woff2
34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956  inter-latin-ext-wght-normal.woff2
1be3448e292fbf05ffe176fe1e43f135013d50b1e7d324ad1a558f623d3bb6f6  inter-greek-wght-normal.woff2
14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb  jetbrains-mono-latin-400-normal.woff2
505dfba8ecbe77e82765f36d317ed7ef4ac42719dc5f4ae68d1c483fd22d0d14  jetbrains-mono-latin-ext-400-normal.woff2
365b7a8eaff022b13ed0561fde3890a04a30507d773ecd5adb3aca8e766a285c  jetbrains-mono-greek-400-normal.woff2
```
