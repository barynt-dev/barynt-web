import {
  describe,
  el,
  type Field,
  type FieldOptions,
  fieldShell,
  nextId,
  PALETTE,
  type PaletteColor,
  safeColor,
  styled,
} from "./core";
import { icon } from "./display";
import type { IconName } from "./icons";

// The UI kit's inputs (BARY-204, BARY-206). Each returns a field: its
// element in `el`, and `value`, `disabled`, `focus()`. The sandbox doesn't
// submit forms, so there's no form: `onEnter` and a button's `onClick` do
// the saving.

/** A `Field` over a control whose state lives in it. */
function fieldOf<T>(
  wrap: HTMLElement,
  get: () => T,
  set: (value: T) => void,
  controls: () => (
    | HTMLInputElement
    | HTMLButtonElement
    | HTMLSelectElement
    | HTMLTextAreaElement
  )[],
): Field<T> {
  return {
    el: wrap,
    get value() {
      return get();
    },
    set value(v) {
      set(v);
    },
    get disabled() {
      return controls()[0]?.disabled ?? false;
    },
    set disabled(v) {
      for (const c of controls()) c.disabled = v;
    },
    focus: () => controls()[0]?.focus(),
  };
}

/** A field of `<input>` or `<textarea>`, read and written as text. */
function textControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  options: FieldOptions & { value?: string; onInput?: (value: string) => void },
): Field<string> {
  styled();
  control.value = options.value ?? "";
  if (options.onInput) {
    const onInput = options.onInput;
    control.addEventListener("input", () => onInput(control.value));
  }
  return fieldOf(
    fieldShell(options, control),
    () => control.value,
    (v) => {
      control.value = v;
    },
    () => [control],
  );
}

/**
 * A one-line text field. `onEnter` runs on Enter — the sandbox doesn't
 * submit forms, so this is how a field saves.
 */
export function textField(
  options: FieldOptions & {
    value?: string;
    placeholder?: string;
    type?: "text" | "url" | "email" | "number" | "password" | "search";
    onInput?: (value: string) => void;
    onEnter?: () => void;
  },
): Field<string> {
  const input = el("input", "bui-input");
  input.type = options.type ?? "text";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.onEnter) {
    const onEnter = options.onEnter;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        onEnter();
      }
    });
  }
  return textControl(input, options);
}

/** A multi-line text field. */
export function textArea(
  options: FieldOptions & {
    value?: string;
    placeholder?: string;
    rows?: number;
    onInput?: (value: string) => void;
  },
): Field<string> {
  const area = el("textarea", "bui-textarea");
  area.rows = options.rows ?? 4;
  if (options.placeholder) area.placeholder = options.placeholder;
  return textControl(area, options);
}

/** A date (`YYYY-MM-DD`), with the browser's own picker. */
export function dateField(
  options: FieldOptions & {
    value?: string;
    min?: string;
    max?: string;
    onChange?: (value: string) => void;
  },
): Field<string> {
  const input = el("input", "bui-input");
  input.type = "date";
  if (options.min) input.min = options.min;
  if (options.max) input.max = options.max;
  if (options.onChange) {
    const onChange = options.onChange;
    input.addEventListener("change", () => onChange(input.value));
  }
  return textControl(input, options);
}

export interface Option {
  value: string;
  label: string;
  /** Smaller text with it (radio buttons). */
  hint?: string;
}

/** A choice of one, as a dropdown. */
export function select(
  options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
  },
): Field<string> {
  styled();
  const control = el("select", "bui-select");
  for (const option of options.options) {
    const node = el("option", undefined, option.label);
    node.value = option.value;
    control.append(node);
  }
  if (options.value !== undefined) control.value = options.value;
  if (options.onChange) {
    const onChange = options.onChange;
    control.addEventListener("change", () => onChange(control.value));
  }
  return fieldOf(
    fieldShell(options, control),
    () => control.value,
    (v) => {
      control.value = v;
    },
    () => [control],
  );
}

/** An on/off switch, with its label on the left. */
export function toggle(
  options: FieldOptions & {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
  },
): Field<boolean> {
  styled();
  const id = nextId();
  const wrap = el("div", "bui-switch");
  const text = el("span", "bui-switch-text");
  const label = el("label", "bui-label", options.label);
  label.htmlFor = id;
  text.append(label);
  const button = el("button", "bui-toggle");
  button.type = "button";
  button.id = id;
  button.setAttribute("role", "switch");
  let checked = options.checked ?? false;
  const show = () => button.setAttribute("aria-checked", String(checked));
  show();
  describe(text, button, id, options.hint);
  button.addEventListener("click", () => {
    checked = !checked;
    show();
    options.onChange?.(checked);
  });
  wrap.append(text, button);
  return fieldOf(
    wrap,
    () => checked,
    (v) => {
      checked = v;
      show();
    },
    () => [button],
  );
}

/** A checkbox with its label on the right — for "I agree", a list of them. */
export function checkbox(
  options: FieldOptions & {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
  },
): Field<boolean> {
  styled();
  const id = nextId();
  const wrap = el("label", "bui-check");
  const input = el("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = options.checked ?? false;
  const text = el("span", "bui-check-text", options.label);
  wrap.append(input, text);
  describe(text, input, id, options.hint);
  if (options.onChange) {
    const onChange = options.onChange;
    input.addEventListener("change", () => onChange(input.checked));
  }
  return fieldOf(
    wrap,
    () => input.checked,
    (v) => {
      input.checked = v;
    },
    () => [input],
  );
}

/** A group's frame: a fieldset with the label as its legend. */
function group(options: FieldOptions, inner: HTMLElement): HTMLFieldSetElement {
  const wrap = el("fieldset", "bui-field");
  wrap.append(el("legend", "bui-label", options.label), inner);
  if (options.hint) wrap.append(el("span", "bui-hint", options.hint));
  return wrap;
}

/** A choice of one, every option in view — for two to five. */
export function radioGroup(
  options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
  },
): Field<string> {
  styled();
  const name = nextId();
  const list = el("div", "bui-options");
  const inputs = options.options.map((option) => {
    const row = el("label", "bui-check");
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.value = option.value;
    input.checked = option.value === options.value;
    const text = el("span", "bui-check-text", option.label);
    if (option.hint) text.append(el("span", "bui-hint", option.hint));
    row.append(input, text);
    list.append(row);
    input.addEventListener("change", () => {
      if (input.checked) options.onChange?.(input.value);
    });
    return input;
  });
  return fieldOf(
    group(options, list),
    () => inputs.find((i) => i.checked)?.value ?? "",
    (v) => {
      for (const i of inputs) i.checked = i.value === v;
    },
    () => inputs,
  );
}

/** Buttons side by side, one of them chosen — a short choice that should
 *  stay in view (a view mode, a range). Arrow keys move between them. */
export function segmentedControl(
  options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
  },
): Field<string> {
  styled();
  const bar = el("div", "bui-segments");
  bar.setAttribute("role", "radiogroup");
  bar.setAttribute("aria-label", options.label);
  let value = options.value ?? options.options[0]?.value ?? "";
  const buttons = options.options.map((option) => {
    const b = el("button", "bui-segment", option.label);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.value = option.value;
    b.addEventListener("click", () => choose(option.value, true));
    bar.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons) {
      const on = b.dataset.value === value;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  const choose = (v: string, tell: boolean) => {
    value = v;
    show();
    if (tell) options.onChange?.(v);
  };
  bar.addEventListener("keydown", (event) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const i = buttons.findIndex((b) => b.dataset.value === value);
    const next = buttons[(i + step + buttons.length) % buttons.length];
    choose(next.dataset.value ?? "", true);
    next.focus();
  });
  show();
  const wrap = el("div", "bui-field");
  wrap.append(el("span", "bui-label", options.label), bar);
  if (options.hint) wrap.append(el("span", "bui-hint", options.hint));
  return fieldOf(
    wrap,
    () => value,
    (v) => choose(v, false),
    () => buttons,
  );
}

/** Any number of options, as chips — pressed when chosen. */
export function multiSelect(
  options: FieldOptions & {
    options: Option[];
    value?: string[];
    onChange?: (value: string[]) => void;
  },
): Field<string[]> {
  styled();
  let chosen = [...(options.value ?? [])];
  const chips = el("div", "bui-chips");
  const buttons = options.options.map((option) => {
    const b = el(
      "button",
      "bui-chip-toggle",
      icon("check", { size: 13 }),
      option.label,
    );
    b.type = "button";
    b.dataset.value = option.value;
    b.addEventListener("click", () => {
      chosen = chosen.includes(option.value)
        ? chosen.filter((v) => v !== option.value)
        : [...chosen, option.value];
      show();
      options.onChange?.([...chosen]);
    });
    chips.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons)
      b.setAttribute(
        "aria-pressed",
        String(chosen.includes(b.dataset.value ?? "")),
      );
  };
  show();
  return fieldOf(
    group(options, chips),
    () => [...chosen],
    (v) => {
      chosen = [...v];
      show();
    },
    () => buttons,
  );
}

/** One of the palette's colours — for a plugin's own labels, markers. */
export function swatchPicker(
  options: FieldOptions & {
    value?: PaletteColor;
    colors?: readonly PaletteColor[];
    onChange?: (value: PaletteColor) => void;
  },
): Field<PaletteColor | ""> {
  styled();
  const colors = options.colors ?? PALETTE;
  let value: PaletteColor | "" = options.value ?? "";
  const list = el("div", "bui-swatches");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", options.label);
  const buttons = colors.map((color) => {
    const b = el("button", "bui-swatch");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", color);
    b.dataset.color = color;
    b.style.setProperty("--swatch", safeColor(color) ?? "");
    b.addEventListener("click", () => {
      value = color;
      show();
      options.onChange?.(color);
    });
    list.append(b);
    return b;
  });
  const show = () => {
    for (const b of buttons) {
      b.setAttribute("aria-checked", String(b.dataset.color === value));
      b.tabIndex =
        b.dataset.color === value || (!value && b === buttons[0]) ? 0 : -1;
    }
  };
  show();
  const wrap = el("div", "bui-field");
  wrap.append(el("span", "bui-label", options.label), list);
  if (options.hint) wrap.append(el("span", "bui-hint", options.hint));
  return fieldOf(
    wrap,
    () => value,
    (v) => {
      value = v;
      show();
    },
    () => buttons,
  );
}

/**
 * A button. An `onClick` that returns a promise keeps it disabled (and
 * `aria-busy`) until it settles, so nobody saves twice. With only an `icon`
 * and no visible text, `label` is what screen readers say.
 */
export function button(options: {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: IconName;
  /** Show only the icon; `label` becomes its accessible name and tooltip. */
  iconOnly?: boolean;
  onClick?: () => void | Promise<unknown>;
}): HTMLButtonElement {
  styled();
  const node = el("button", "bui-button");
  if (options.icon) node.append(icon(options.icon, { size: 15 }));
  if (options.iconOnly && options.icon) {
    node.setAttribute("aria-label", options.label);
    node.dataset.buiTip = options.label;
    node.dataset.iconOnly = "";
  } else node.append(options.label);
  node.type = "button";
  node.dataset.variant = options.variant ?? "secondary";
  if (options.size === "sm") node.dataset.size = "sm";
  if (options.onClick) {
    const onClick = options.onClick;
    node.addEventListener("click", async () => {
      if (node.disabled) return;
      const running = onClick();
      if (!(running instanceof Promise)) return;
      node.disabled = true;
      node.setAttribute("aria-busy", "true");
      try {
        await running;
      } finally {
        node.disabled = false;
        node.removeAttribute("aria-busy");
      }
    });
  }
  return node;
}
