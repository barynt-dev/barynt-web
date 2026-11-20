import { describe, expect, it } from "bun:test";
import { aboutDoc } from "@/lib/plugins/about";
import type { PMNode } from "@/lib/richtext/types";

const types = (nodes: PMNode[] = []): string[] =>
  nodes.flatMap((n) => [n.type, ...types(n.content)]);
const marks = (nodes: PMNode[] = []): string[] =>
  nodes.flatMap((n) => [
    ...(n.marks ?? []).map((m) => m.type),
    ...marks(n.content),
  ]);

describe("aboutDoc (BARY-237)", () => {
  it("keeps text, headings, lists, quotes and code", () => {
    const doc = aboutDoc(
      "# Title\n\nSome **bold** and _italic_ and `code`.\n\n- one\n- two\n\n> quoted\n\n```ts\nconst a = 1;\n```",
    );
    expect(types(doc?.content)).toEqual(
      expect.arrayContaining([
        "heading",
        "paragraph",
        "bulletList",
        "listItem",
        "blockquote",
        "codeBlock",
      ]),
    );
    expect(marks(doc?.content)).toEqual(
      expect.arrayContaining(["bold", "italic", "code"]),
    );
  });

  it("drops links but keeps their text, and drops images", () => {
    const doc = aboutDoc(
      "See [the docs](https://evil.example) now.\n\n![shot](https://evil.example/x.png)",
    );
    const json = JSON.stringify(doc);
    expect(json).not.toContain("evil.example");
    expect(json).toContain("the docs");
    expect(marks(doc?.content)).not.toContain("link");
    expect(types(doc?.content)).not.toContain("image");
  });

  it("puts its headings below the page's own", () => {
    const doc = aboutDoc("# One\n\n### Three");
    expect(doc?.content?.map((n) => n.attrs?.level)).toEqual([4, 5]);
  });

  it("is nothing for an empty text", () => {
    expect(aboutDoc("  \n ")).toBeNull();
    expect(aboutDoc(undefined)).toBeNull();
  });
});
