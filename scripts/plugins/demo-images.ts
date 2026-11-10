// Screenshots for the demo plugins (BARY-199): small PNGs of made-up
// screens, drawn from rectangles so the demo needs no image files. Only for
// `bun run plugins:demo`.

import { deflateSync } from "node:zlib";

const W = 960;
const H = 600;

type RGB = [number, number, number];
const hex = (h: string): RGB => [
  Number.parseInt(h.slice(1, 3), 16),
  Number.parseInt(h.slice(3, 5), 16),
  Number.parseInt(h.slice(5, 7), 16),
];

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function png(pixels: Uint8Array): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++)
    raw.set(pixels.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, W);
  view.setUint32(4, H);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A canvas of the app's dark theme, with a top bar and a side bar. */
function screen(
  draw: (
    rect: (x: number, y: number, w: number, h: number, color: string) => void,
  ) => void,
) {
  const pixels = new Uint8Array(W * H * 3);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    const [r, g, b] = hex(color);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        const i = (yy * W + xx) * 3;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
      }
  };
  rect(0, 0, W, H, "#0c1518");
  rect(0, 0, 180, H, "#10191c");
  for (let i = 0; i < 6; i++)
    rect(20, 70 + i * 34, 120 - (i % 3) * 20, 12, "#2a383d");
  rect(180, 0, W - 180, 52, "#10191c");
  rect(204, 18, 160, 16, "#3a494f");
  draw(rect);
  return png(pixels);
}

export type DemoScreen = "timeline" | "board" | "settings" | "chat" | "list";

/** A made-up screen of a plugin in `accent`, as a PNG. */
export function demoScreenshot(kind: DemoScreen, accent: string): Uint8Array {
  return screen((rect) => {
    if (kind === "timeline") {
      for (let i = 0; i < 9; i++) rect(204 + i * 82, 76, 1, H - 100, "#1d2a2e");
      const bars = [
        [0, 3],
        [1, 5],
        [3, 4],
        [2, 2],
        [5, 3],
        [4, 4],
        [6, 2],
        [7, 2],
      ];
      bars.forEach(([start, len], row) => {
        rect(204, 92 + row * 56, 140, 12, "#3a494f");
        rect(
          360 + start * 60,
          86 + row * 56,
          len * 60,
          24,
          row % 3 === 0 ? accent : "#2f6f78",
        );
      });
    } else if (kind === "board") {
      for (let c = 0; c < 4; c++) {
        rect(204 + c * 186, 76, 170, 18, "#2a383d");
        for (let k = 0; k < 4 - (c % 2); k++) {
          rect(204 + c * 186, 108 + k * 112, 170, 98, "#151d20");
          rect(216 + c * 186, 122 + k * 112, 120, 10, "#5c6b70");
          rect(216 + c * 186, 142 + k * 112, 80, 8, "#3a494f");
          rect(
            216 + c * 186,
            176 + k * 112,
            56,
            16,
            k === 1 ? accent : "#2a383d",
          );
        }
      }
    } else if (kind === "settings") {
      rect(204, 76, 240, 20, "#dbe4e8");
      for (let i = 0; i < 4; i++) {
        rect(204, 124 + i * 92, 160, 12, "#8a9a9f");
        rect(204, 146 + i * 92, 520, 40, "#070f12");
        rect(204, 146 + i * 92, 520, 2, "#3a494f");
      }
      rect(204, 500, 120, 36, accent);
    } else if (kind === "chat") {
      for (let i = 0; i < 4; i++) {
        const y = 80 + i * 124;
        rect(204, y, 40, 40, accent);
        rect(260, y, 140, 12, "#8a9a9f");
        rect(260, y + 24, 520, 84, "#151d20");
        rect(260, y + 24, 6, 84, i % 2 ? "#5ab98a" : "#e0992b");
        rect(282, y + 40, 300, 12, "#dbe4e8");
        rect(282, y + 64, 220, 10, "#5c6b70");
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const y = 80 + i * 62;
        rect(204, y, W - 228, 52, i % 2 ? "#10191c" : "#151d20");
        rect(220, y + 18, 16, 16, i === 2 ? accent : "#3a494f");
        rect(252, y + 20, 260, 12, "#8a9a9f");
        rect(W - 140, y + 16, 92, 20, i < 3 ? accent : "#2a383d");
      }
    }
  });
}
