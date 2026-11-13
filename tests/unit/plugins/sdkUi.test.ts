import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  barChart,
  button,
  kpi,
  list,
  progressRing,
  select,
  status,
  textArea,
  textField,
  toggle,
} from "@barynt/plugin-sdk/ui";
import { Window } from "happy-dom";

// The SDK's UI kit (BARY-204), on happy-dom: what a plugin's frame gets.

const g = globalThis as { document?: unknown };
let window: Window;
beforeAll(() => {
  window = new Window();
  g.document = window.document;
});
afterAll(async () => {
  delete g.document;
  await window.happyDOM.close();
});

const keydown = (target: EventTarget, key: string) =>
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key }) as never);

describe("the UI kit", () => {
  it("brings its styles once", () => {
    textField({ label: "A" });
    toggle({ label: "B" });
    expect(document.head.querySelectorAll("style#barynt-ui")).toHaveLength(1);
  });

  it("labels a text field and reads, writes and submits it", () => {
    let entered = 0;
    const typed: string[] = [];
    const field = textField({
      label: "GitLab project",
      hint: "Like acme/web",
      value: "acme/web",
      onInput: (v) => typed.push(v),
      onEnter: () => entered++,
    });
    const input = field.el.querySelector("input") as HTMLInputElement;
    const label = field.el.querySelector("label") as HTMLLabelElement;
    expect(label.textContent).toBe("GitLab project");
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute("aria-describedby")).toBe(`${input.id}-hint`);
    expect(field.value).toBe("acme/web");

    input.value = "acme/app";
    input.dispatchEvent(new window.Event("input") as never);
    expect(typed).toEqual(["acme/app"]);
    keydown(input, "Enter");
    keydown(input, "a");
    expect(entered).toBe(1);

    field.value = "x";
    field.disabled = true;
    expect(input.value).toBe("x");
    expect(input.disabled).toBe(true);
  });

  it("puts text in as text, never as HTML", () => {
    const field = textArea({ label: "<b>Note</b>" });
    expect(field.el.querySelector("b")).toBeNull();
    const rows = list({ items: [{ title: "<img src=x>", meta: "2d" }] });
    expect(rows.querySelector("img")).toBeNull();
    expect(rows.textContent).toContain("<img src=x>");
  });

  it("chooses with a select and switches with a toggle", () => {
    const changes: string[] = [];
    const choice = select({
      label: "Branch",
      options: [
        { value: "main", label: "main" },
        { value: "dev", label: "dev" },
      ],
      value: "dev",
      onChange: (v) => changes.push(v),
    });
    expect(choice.value).toBe("dev");
    const control = choice.el.querySelector("select") as HTMLSelectElement;
    control.value = "main";
    control.dispatchEvent(new window.Event("change") as never);
    expect(changes).toEqual(["main"]);

    const flips: boolean[] = [];
    const sw = toggle({ label: "Drafts", onChange: (v) => flips.push(v) });
    const knob = sw.el.querySelector("button") as HTMLButtonElement;
    expect(knob.getAttribute("role")).toBe("switch");
    expect(knob.getAttribute("aria-checked")).toBe("false");
    knob.click();
    expect(sw.value).toBe(true);
    expect(knob.getAttribute("aria-checked")).toBe("true");
    expect(flips).toEqual([true]);
  });

  it("keeps a button busy while its work runs", async () => {
    let finish = () => {};
    let runs = 0;
    const save = button({
      label: "Save",
      variant: "primary",
      onClick: () => {
        runs++;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    });
    expect(save.type).toBe("button");
    save.click();
    save.click();
    expect(runs).toBe(1);
    expect(save.disabled).toBe(true);
    expect(save.getAttribute("aria-busy")).toBe("true");
    finish();
    await Bun.sleep(0);
    expect(save.disabled).toBe(false);
  });

  it("says how it went", () => {
    const line = status();
    expect(line.el.getAttribute("role")).toBe("status");
    line.set("Saved.", "success");
    expect(line.el.textContent).toBe("Saved.");
    expect(line.el.dataset.tone).toBe("success");
    line.clear();
    expect(line.el.textContent).toBe("");
  });

  it("draws a number, a list, bars and a ring", () => {
    const number = kpi({
      value: 12,
      label: "Open merge requests",
      trend: { text: "+3", good: false },
    });
    expect(number.textContent).toContain("12");
    expect(
      (number.querySelector(".bui-kpi-trend") as HTMLElement).dataset.good,
    ).toBe("false");

    const links = list({
      items: [{ title: "WEB-7", href: "https://gitlab.com/x", meta: "Ada" }],
    });
    const a = links.querySelector("a") as HTMLAnchorElement;
    expect(a.rel).toContain("noopener");
    expect(list({ items: [], empty: "None open." }).textContent).toBe(
      "None open.",
    );

    const bars = barChart({
      bars: [
        { label: "High", value: 4, color: "#ff0000" },
        { label: "Low", value: 2, color: "red;background:url(x)" },
      ],
    });
    const fills = [...bars.querySelectorAll(".bui-bar-fill")] as HTMLElement[];
    expect(fills.map((f) => f.style.width)).toEqual(["100%", "50%"]);
    // Only a colour, nothing smuggled in.
    expect(fills[1].style.getPropertyValue("--bar")).toBe("");

    const ring = progressRing({ value: 3, max: 4, label: "Done" });
    expect(ring.getAttribute("aria-label")).toBe("Done: 75%");
  });
});
