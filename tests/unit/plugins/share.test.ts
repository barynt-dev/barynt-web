import { describe, expect, it } from "bun:test";
import {
  embedHtml,
  SHARE_NAMES,
  SHARE_NETWORKS,
  shareText,
  shareUrl,
} from "@/lib/plugins/share";

const input = {
  url: "https://example.com/plugin?a=1&b=2",
  text: "GitHub – Pull requests & checks",
  title: "GitHub",
};

describe("shareUrl (BARY-237)", () => {
  it("knows eight networks, each with a name", () => {
    expect(SHARE_NETWORKS).toHaveLength(8);
    for (const n of SHARE_NETWORKS) expect(SHARE_NAMES[n]).toBeTruthy();
  });

  it("puts the address into each network's share page, encoded", () => {
    const u = encodeURIComponent(input.url);
    for (const network of SHARE_NETWORKS) {
      const href = shareUrl(network, input);
      expect(href).toStartWith("https://");
      // The address' own `?` and `&` must not leak into the share page's.
      expect(href).toContain(u.slice(0, 30));
      expect(href).not.toContain("plugin?a=1&b=2");
    }
    expect(shareUrl("linkedin", input)).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    );
    expect(shareUrl("facebook", input)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    );
  });

  it("sends text where the network takes it, text and address together where it has one field", () => {
    const t = encodeURIComponent(input.text);
    expect(shareUrl("x", input)).toContain(`&text=${t}`);
    expect(shareUrl("telegram", input)).toContain(`&text=${t}`);
    expect(shareUrl("reddit", input)).toContain("&title=GitHub");
    for (const network of ["whatsapp", "bluesky"] as const)
      expect(shareUrl(network, input)).toContain(
        encodeURIComponent(`${input.text} ${input.url}`),
      );
  });
});

describe("shareText", () => {
  it("joins name and description", () => {
    expect(shareText("GitHub", "Pull requests.")).toBe(
      "GitHub – Pull requests.",
    );
  });

  it("cuts a long text at the limit, with an ellipsis", () => {
    const text = shareText("GitHub", "word ".repeat(100), 60);
    expect(text.length).toBeLessThanOrEqual(60);
    expect(text).toEndWith("…");
  });

  it("flattens line breaks and runs of spaces", () => {
    expect(shareText("A", "b\n\n  c")).toBe("A – b c");
  });
});

describe("embedHtml", () => {
  const html = embedHtml({ url: "https://example.com/p", name: "GitHub" });

  it("is one plain link that opens the address in a new tab, safely", () => {
    expect(html).toBe(
      '<a href="https://example.com/p" target="_blank" rel="noopener noreferrer">GitHub</a>',
    );
  });

  it("has no styling, script, frame or picture", () => {
    expect(html).not.toMatch(/style=|<(script|iframe|img|link|style)/i);
  });

  it("escapes what comes from a manifest", () => {
    const evil = embedHtml({
      url: 'https://example.com/"><script>alert(1)</script>',
      name: '<img src=x onerror=alert(1)> & "q"',
    });
    expect(evil).not.toContain("<script");
    expect(evil).not.toContain("<img");
    expect(evil).toContain(
      "&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;",
    );
    // The attribute can't be left early.
    expect(evil).toContain(
      'href="https://example.com/&quot;&gt;&lt;script&gt;',
    );
  });
});
