import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Lightbox } from "@/components/ui/layout/Lightbox/Lightbox";

const labels = {
  dialog: "Screenshots",
  close: "Close full screen",
  previous: "Previous",
  next: "Next",
};
const images = [
  { src: "a.png", title: "Board" },
  { src: "b.png", title: "Panel" },
  { src: "c.png", title: "Rules" },
];
const render = (over: Partial<Parameters<typeof Lightbox>[0]> = {}) =>
  renderToStaticMarkup(
    <Lightbox
      images={images}
      index={1}
      onIndex={() => {}}
      onClose={() => {}}
      labels={labels}
      {...over}
    />,
  );

describe("Lightbox (BARY-236)", () => {
  test("shows the image it's on, its place and title, and a close button", () => {
    const html = render();
    expect(html).toContain('src="b.png"');
    expect(html).toContain("2 / 3");
    expect(html).toContain("Panel");
    expect(html).toContain('aria-label="Close full screen"');
  });

  test("marks the current thumbnail and has arrows to step", () => {
    const html = render();
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(
      /aria-current="true"[^>]*data-index="1"|data-index="1"[^>]*aria-current="true"/,
    );
    expect(html).toContain('aria-label="Previous"');
    expect(html).toContain('aria-label="Next"');
  });

  test("keeps an index past the end on the last image", () => {
    expect(render({ index: 9 })).toContain('src="c.png"');
  });

  test("has neither arrows nor thumbnails for a single image", () => {
    const html = render({ images: [images[0]], index: 0 });
    expect(html).not.toContain('aria-label="Next"');
    expect(html).not.toContain("data-index");
    expect(html).not.toContain(" / ");
  });
});
