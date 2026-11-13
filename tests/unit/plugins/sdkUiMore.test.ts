import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { TOKEN_NAMES as SDK_TOKENS } from "@barynt/plugin-sdk";
import {
  accordion,
  avatar,
  badge,
  button,
  card,
  checkbox,
  copyField,
  dialog,
  diffStat,
  emptyState,
  grid,
  heading,
  ICONS,
  icon,
  keyValue,
  labelChip,
  link,
  multiSelect,
  navList,
  notice,
  onThemeChange,
  progressBar,
  radioGroup,
  sectionHeader,
  segmentedControl,
  skeleton,
  spinner,
  statusDot,
  stepList,
  swatchPicker,
  table,
  tabs,
  tag,
  text,
  theme,
  toast,
  token,
  tokenVariable,
  tooltip,
  user,
} from "@barynt/plugin-sdk/ui";
import { Window } from "happy-dom";
import { buildFrameDocument } from "@/lib/plugins/frame";
import { HOST_TOKENS, TOKEN_NAMES, tokenCss } from "@/lib/plugins/tokens";

// The UI kit's components and design tokens (BARY-206), on happy-dom.

const g = globalThis as { document?: unknown; window?: unknown };
let window: Window;
let savedWindow: unknown;
beforeAll(() => {
  window = new Window();
  savedWindow = g.window;
  g.document = window.document;
  g.window = window;
});
afterAll(async () => {
  delete g.document;
  g.window = savedWindow;
  await window.happyDOM.close();
});

const press = (target: EventTarget, key: string) =>
  target.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true }) as never,
  );

describe("design tokens", () => {
  it("are the same list in Barynt and in the SDK", () => {
    expect([...SDK_TOKENS]).toEqual(TOKEN_NAMES);
  });

  it("become stable CSS variables in every frame", () => {
    expect(token("color.text.subtle")).toBe("var(--barynt-color-text-subtle)");
    expect(tokenVariable("space.4")).toBe("--barynt-space-4");
    const css = tokenCss();
    expect(css).toContain("--barynt-color-text: var(--on-surface);");
    expect(css).toContain("--barynt-space-4: 1rem;");
    expect(css.match(/--barynt-/g)).toHaveLength(TOKEN_NAMES.length);
    // What they point at reaches the frame, and Barynt's old names too.
    expect(HOST_TOKENS).toContain("--on-surface");
    expect(HOST_TOKENS).toContain("--text-sm");
    const doc = buildFrameDocument({
      code: "export default class {}",
      css: null,
      nonce: "n",
      title: "Demo",
    });
    expect(doc).toContain("--barynt-color-surface-raised");
  });

  it("tell light from dark, and when it switches", () => {
    document.documentElement.dataset.theme = "dark";
    expect(theme()).toBe("dark");
    const seen: string[] = [];
    const stop = onThemeChange((t) => seen.push(t));
    document.documentElement.dataset.theme = "light";
    window.dispatchEvent(new window.Event("barynt:themechange") as never);
    stop();
    window.dispatchEvent(new window.Event("barynt:themechange") as never);
    expect(seen).toEqual(["light"]);
  });
});

describe("text, layout and small things", () => {
  it("never takes HTML", () => {
    const evil = "<img src=x onerror=alert(1)>";
    for (const node of [
      heading({ text: evil }),
      text({ text: evil }),
      badge({ text: evil }),
      tag({ text: evil }),
      notice({ text: evil, title: evil }),
      card({ title: evil, children: [evil] }),
      emptyState({ title: evil, text: evil }),
      user({ name: evil, meta: evil }),
      keyValue({ items: [{ label: evil, value: evil }] }),
      table({ columns: [{ key: "a", label: evil }], rows: [{ a: evil }] }),
    ]) {
      expect(node.querySelector("img")).toBeNull();
      expect(node.textContent).toContain(evil);
    }
  });

  it("lets only real links and colours through", () => {
    expect(link({ text: "x", href: "javascript:alert(1)" }).tagName).toBe(
      "SPAN",
    );
    const a = link({
      text: "Docs",
      href: "https://barynt.dev",
    }) as HTMLAnchorElement;
    expect(a.rel).toContain("noopener");
    expect(
      tag({ text: "t", color: "red;background:url(x)" }).style.getPropertyValue(
        "--tag",
      ),
    ).toBe("");
    expect(
      labelChip({ name: "Bug", color: "red" }).style.getPropertyValue("--tag"),
    ).toBe("var(--barynt-color-red)");
    expect(
      grid({ children: [], minWidth: "1px;x:y" }).style.getPropertyValue(
        "--bui-min",
      ),
    ).toBe("");
  });

  it("draws headings at their level, icons as shapes", () => {
    expect(heading({ text: "Hi", level: 3 }).tagName).toBe("H3");
    const svg = icon("check");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.children).toHaveLength(ICONS.check.length);
    expect(icon("info", { label: "Info" }).getAttribute("aria-label")).toBe(
      "Info",
    );
  });

  it("says what it is to screen readers", () => {
    expect(avatar({ name: "Ada Lovelace" }).textContent).toBe("AL");
    expect(spinner().getAttribute("role")).toBe("status");
    expect(skeleton({ lines: 2 }).children).toHaveLength(2);
    expect(notice({ text: "x", tone: "danger" }).getAttribute("role")).toBe(
      "alert",
    );
    expect(
      statusDot({ label: "Done", category: "completed" }).dataset.category,
    ).toBe("completed");
    const bar = progressBar({ value: 3, max: 4, label: "Done" });
    const track = bar.querySelector("[role=progressbar]") as HTMLElement;
    expect(track.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.textContent).toContain("75%");
    const b = tooltip(button({ label: "Save" }), "Saves it");
    expect(b.dataset.buiTip).toBe("Saves it");
    expect(
      document.getElementById(b.getAttribute("aria-describedby") ?? "") ??
        b.querySelector(".bui-sr"),
    ).not.toBeNull();
    const only = button({ label: "Delete", icon: "trash", iconOnly: true });
    expect(only.getAttribute("aria-label")).toBe("Delete");
  });

  it("puts a toast in the corner and takes it away again", () => {
    toast("Saved", { tone: "success", duration: 1000 });
    expect(document.querySelector(".bui-toasts")?.textContent).toContain(
      "Saved",
    );
  });
});

describe("inputs", () => {
  it("checks a box, picks one radio", () => {
    const seen: unknown[] = [];
    const box = checkbox({ label: "Agree", onChange: (v) => seen.push(v) });
    // happy-dom doesn't fire `change` on a click; a browser does.
    const change = (i: HTMLInputElement) => {
      i.checked = true;
      i.dispatchEvent(new window.Event("change") as never);
    };
    change(box.el.querySelector("input") as HTMLInputElement);
    expect(box.value).toBe(true);
    const radios = radioGroup({
      label: "Mode",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      value: "a",
      onChange: (v) => seen.push(v),
    });
    expect(radios.el.tagName).toBe("FIELDSET");
    change(radios.el.querySelectorAll("input")[1] as HTMLInputElement);
    expect(radios.value).toBe("b");
    expect(seen).toEqual([true, "b"]);
  });

  it("moves through a segmented control with the arrow keys", () => {
    const seen: string[] = [];
    const seg = segmentedControl({
      label: "Range",
      options: [
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
      ],
      onChange: (v) => seen.push(v),
    });
    const group = seg.el.querySelector("[role=radiogroup]") as HTMLElement;
    expect(seg.value).toBe("7");
    press(group, "ArrowRight");
    expect(seg.value).toBe("30");
    press(group, "ArrowRight");
    expect(seen).toEqual(["30", "7"]);
  });

  it("chooses several, and a colour of the palette", () => {
    const multi = multiSelect({
      label: "Days",
      options: [
        { value: "mon", label: "Mon" },
        { value: "tue", label: "Tue" },
      ],
      value: ["mon"],
    });
    (multi.el.querySelectorAll("button")[1] as HTMLButtonElement).click();
    expect(multi.value).toEqual(["mon", "tue"]);
    const swatch = swatchPicker({ label: "Colour", value: "teal" });
    expect(swatch.value).toBe("teal");
    (
      swatch.el.querySelector('[aria-label="red"]') as HTMLButtonElement
    ).click();
    expect(swatch.value).toBe("red");
  });
});

describe("data and overlays", () => {
  it("opens tabs lazily, with the keyboard too", () => {
    let drawn = 0;
    const root = tabs({
      tabs: [
        { id: "a", label: "A", content: "first" },
        {
          id: "b",
          label: "B",
          content: () => {
            drawn++;
            return "second";
          },
        },
      ],
    });
    expect(drawn).toBe(0);
    press(root.querySelector("[role=tablist]") as HTMLElement, "ArrowRight");
    expect(drawn).toBe(1);
    const selected = root.querySelector('[aria-selected="true"]');
    expect(selected?.textContent).toBe("B");
  });

  it("aligns numbers in a table, folds an accordion", () => {
    const t = table({
      columns: [
        { key: "name", label: "Name" },
        { key: "n", label: "Open", align: "end" },
      ],
      rows: [{ name: badge({ text: "Web" }), n: 3 }],
    });
    expect(t.querySelector("td[data-align=end]")?.textContent).toBe("3");
    expect(t.querySelector(".bui-badge")).not.toBeNull();
    expect(table({ columns: [], rows: [], empty: "None" }).textContent).toBe(
      "None",
    );
    const acc = accordion({
      items: [{ title: "More", content: "x", open: true }],
    });
    expect((acc.querySelector("details") as HTMLDetailsElement).open).toBe(
      true,
    );
  });

  it("builds a dialog with a title it's named by", () => {
    const d = dialog({ title: "Delete?", content: ["Gone for good."] });
    const id = d.el.getAttribute("aria-labelledby") ?? "";
    expect(d.el.querySelector(`#${id}`)?.textContent).toBe("Delete?");
    expect(d.el.querySelector("[aria-label=Close]")).not.toBeNull();
  });
});

describe("development pieces (BARY-209)", () => {
  it("copies a value, opens only real links", async () => {
    let copied = "";
    const nav = globalThis.navigator as { clipboard?: unknown };
    const saved = nav.clipboard;
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: async (v: string) => {
          copied = v;
        },
      },
      configurable: true,
    });
    const field = copyField({
      value: "ada/web-7-empty-states",
      icon: "git-branch",
      href: "https://gitlab.com/acme/web",
    });
    (field.querySelector("button") as HTMLButtonElement).click();
    await Bun.sleep(0);
    expect(copied).toBe("ada/web-7-empty-states");
    expect(field.querySelector("a")?.getAttribute("rel")).toContain("noopener");
    expect(
      copyField({ value: "x", href: "javascript:alert(1)" }).querySelector("a"),
    ).toBeNull();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: saved,
      configurable: true,
    });
  });

  it("lists steps with their state, rows that lead somewhere", () => {
    const steps = stepList({
      steps: [
        { label: "Build", state: "success", meta: "1m 12s" },
        { label: "Test", state: "danger" },
      ],
    });
    expect(steps.querySelectorAll("li")).toHaveLength(2);
    expect(steps.querySelector("li")?.getAttribute("aria-label")).toBe(
      "Build: success",
    );
    let opened = 0;
    const nav = navList({
      items: [
        {
          label: "Commit",
          count: 1,
          icon: "git-commit-horizontal",
          onClick: () => opened++,
        },
        { label: "Deployments", href: "https://ci.example.com" },
        { label: "Nothing" },
      ],
    });
    (nav.querySelector("button") as HTMLButtonElement).click();
    expect(opened).toBe(1);
    expect(nav.querySelector("a")?.getAttribute("href")).toBe(
      "https://ci.example.com/",
    );
    expect(
      (nav.querySelectorAll("button")[1] as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("heads a card with a state, counts a diff", () => {
    const head = sectionHeader({
      title: "Pipeline",
      icon: "circle-check",
      status: { text: "Passed", tone: "success" },
    });
    expect(
      (head.querySelector(".bui-section-status") as HTMLElement).dataset.tone,
    ).toBe("success");
    expect(diffStat({ added: 9, removed: 4 }).textContent).toBe("+9−4");
  });
});
