import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import type { PMDoc, PMMark, PMNode } from "@/lib/richtext/types";

// A plugin's page text (BARY-237): Markdown from its manifest, as a
// ProseMirror document for `RichText`. What a plugin may write is less than
// an issue may hold: text, headings, lists, quotes, code — no links, no
// images, nothing that reaches out. A link's text stays, its address goes;
// addresses belong in the manifest's `links`, which the store shows on its
// own terms.

/** Node types kept, and what a task list becomes. */
const KEEP = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "text",
]);
const RENAME: Record<string, string> = {
  taskList: "bulletList",
  taskItem: "listItem",
};
const MARKS = new Set(["bold", "italic", "strike", "code"]);

/** Its headings sit below the page's own "About …" (`h3`). */
const headingLevel = (level: unknown) =>
  typeof level === "number" && level >= 3 ? 5 : 4;

const codeLanguage = (language: unknown) =>
  typeof language === "string" && /^[\w+#-]{1,20}$/.test(language)
    ? language
    : null;

function clean(node: PMNode): PMNode | null {
  const type = RENAME[node.type] ?? node.type;
  if (!KEEP.has(type)) return null;
  if (type === "text") {
    if (!node.text) return null;
    const marks = node.marks?.filter((m: PMMark) => MARKS.has(m.type));
    return { type, text: node.text, ...(marks?.length && { marks }) };
  }
  const content = node.content
    ?.map(clean)
    .filter((n): n is PMNode => n !== null);
  return {
    type,
    ...(type === "heading" && {
      attrs: { level: headingLevel(node.attrs?.level) },
    }),
    ...(type === "orderedList" &&
      node.attrs?.start != null && { attrs: { start: node.attrs.start } }),
    ...(type === "codeBlock" && {
      attrs: { language: codeLanguage(node.attrs?.language) },
    }),
    ...(content && { content }),
  };
}

/** The page text as a document — `null` when there's none. */
export function aboutDoc(markdown: string | null | undefined): PMDoc | null {
  if (!markdown?.trim()) return null;
  const content = (fromMarkdown(markdown).content ?? [])
    .map(clean)
    .filter((n): n is PMNode => n !== null)
    // A paragraph that held only an image is empty now.
    .filter((n) => n.type !== "paragraph" || n.content?.length);
  return content.length ? { type: "doc", content } : null;
}
