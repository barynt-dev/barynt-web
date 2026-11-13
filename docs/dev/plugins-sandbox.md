# Sandbox and limits

A sandboxed plugin's code runs in the browser of the person using it — but
not on Barynt's page. Each place it fills gets a **frame** of its own, with
the plugin's code and nothing of Barynt's.

## What the sandbox takes away

| | |
| --- | --- |
| **Barynt's session** | The frame has its own, empty origin: no cookies, no `localStorage`, no `sessionStorage`, no IndexedDB. Reading `document.cookie` throws. |
| **The network** | `fetch`, `XMLHttpRequest`, WebSockets and `<img src="https://…">` are blocked. Barynt's data comes through the [host API](plugins-host-api.md); your own servers through [`net.fetch`](plugins-host-api.md#netfetch), for the hosts in your manifest. |
| **Other code** | No scripts from anywhere: your `main.js` is all that runs. No `<script src>`, no CDN. Bundle what you need. |
| **The page around it** | The frame can't reach Barynt's page, navigate it or open pop-ups. |
| **Forms** | A `<form>` doesn't submit — not even to a `submit` listener. Handle the button's `click` (and Enter in a field) yourself. |

What's left is plain DOM, CSS, timers, `requestAnimationFrame`, canvas, SVG,
and images from `data:` or `blob:` URLs.

> [!WARNING]
> Never put data into `innerHTML`. Titles, comments and names are text
> people typed; use `textContent` or build the elements.

## Where it shows

A plugin's views and pages appear in the sidebar — under the project it's
switched on in, or in the workspace's main group and "Plugins" section;
see [Manifest → Where they show](plugins-manifest.md#where-they-show).
Each opens a page with the plugin's frame under a header naming the
plugin. Slots are a fixed list (`lib/plugins/slots.ts`); a plugin can't put
anything anywhere else.

## How it starts

1. Barynt loads the frame with your `main.js` and `styles.css` inside it.
2. It hands the frame a private channel, its `context` and the design
   tokens, then loads `main.js` as a module and creates its default export.
3. Your `onload()` runs. Until it's done, the frame stays hidden — no flash
   of an unstyled plugin.
4. If it throws, or doesn't finish within **10 seconds**, Barynt shows
   "*Plugin* ran into an error" or "isn't responding", with **Load again**.

## Looking like Barynt

Barynt's design tokens are set on the frame's `:root` and follow light and
dark mode while the plugin runs:

| Token | For |
| --- | --- |
| `--surface`, `--surface-container-low`, `--surface-container`, `--surface-container-high` | Backgrounds, from the page up to raised areas. |
| `--on-surface`, `--on-surface-variant` | Text, and quieter text. |
| `--outline`, `--outline-variant` | Borders and dividers. |
| `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container` | The accent, and text on it. |
| `--error`, `--warning` | States. |
| `--radius`, `--radius-sm` | Corners. |
| `--text-xs`, `--text-sm`, `--text-base` | Font sizes. |
| `--font-ui` | The font. |

The frame starts with Barynt's background, text colour and font; your
`styles.css` does the rest. Make it work at phone width — a project view
fills the screen there.

## Limits

| | |
| --- | --- |
| `main.js` | up to 5 MB |
| `styles.css` | up to 1 MB |
| `manifest.json` | up to 64 KB |
| Starting (`onload`) | 10 seconds |
| One call | 15 seconds |
| Open calls | 20 at once |
| Calls | 300 per person and minute |
| Storage | see [Host API → Storage](plugins-host-api.md#storage) |
