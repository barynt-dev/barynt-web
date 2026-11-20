import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Headings over runs of items in the shared menu (BARY-237): the store's
// version picker puts releases and betas under their own.

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));

import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";

const render = (items: Parameters<typeof SelectMenu>[0]["items"]) =>
  renderToStaticMarkup(
    <SelectMenu items={items} value="a" onPick={() => {}} />,
  );

describe("SelectMenu groups", () => {
  it("puts a heading over the first item of each group", () => {
    const html = render([
      { value: "a", label: "A", group: "Releases" },
      { value: "b", label: "B", group: "Releases" },
      { value: "c", label: "C", group: "Betas" },
    ]);
    expect(html.match(/role="presentation"/g)).toHaveLength(2);
    expect(html.indexOf("Releases")).toBeLessThan(html.indexOf(">A<"));
    expect(html.indexOf("Betas")).toBeGreaterThan(html.indexOf(">B<"));
    expect(html.indexOf("Betas")).toBeLessThan(html.indexOf(">C<"));
    expect(html.match(/Releases/g)).toHaveLength(1);
  });

  it("keeps the headings out of the items the arrow keys step through", () => {
    const html = render([
      { value: "a", label: "A", group: "Releases" },
      { value: "c", label: "C", group: "Betas" },
    ]);
    expect(html.match(/data-select-item/g)).toHaveLength(2);
  });

  it("looks as before without groups", () => {
    const html = render([
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ]);
    expect(html).not.toContain("presentation");
    expect(html.match(/data-select-item/g)).toHaveLength(2);
  });
});
