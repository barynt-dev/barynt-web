// src/api.ts
class BaryntError extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "BaryntError";
  }
}
var METHODS = [
  "issues.list",
  "issues.get",
  "issues.create",
  "issues.update",
  "comments.list",
  "comments.create",
  "labels.list",
  "projects.list",
  "members.list",
  "fields.list",
  "issueData.list",
  "storage.get",
  "storage.set",
  "storage.delete",
  "storage.list",
  "settings.get",
  "settings.set",
  "net.fetch"
];
async function request(host, method, params) {
  try {
    return await host.call(method, params);
  } catch (error) {
    throw new BaryntError(error instanceof Error ? error.message : String(error));
  }
}
function createApi(host) {
  const call = (method, params) => request(host, method, params);
  return {
    issues: {
      list: (params = {}) => call("issues.list", params),
      get: (id) => call("issues.get", { id }),
      create: (input) => call("issues.create", input),
      update: (id, patch) => call("issues.update", { ...patch, id })
    },
    comments: {
      list: (issueId) => call("comments.list", { issueId }),
      create: (issueId, body, parentId) => call("comments.create", {
        issueId,
        body,
        ...parentId ? { parentId } : {}
      })
    },
    labels: {
      list: (params = {}) => call("labels.list", params)
    },
    projects: { list: () => call("projects.list", {}) },
    members: {
      list: (params = {}) => call("members.list", params)
    },
    fields: {
      list: (params = {}) => call("fields.list", params)
    },
    issueData: {
      list: (issueIds) => call("issueData.list", { issueIds })
    },
    storage: {
      get: (key) => call("storage.get", { key }),
      set: (key, value) => call("storage.set", { key, value }),
      delete: (key) => call("storage.delete", { key }),
      list: () => call("storage.list", {})
    },
    settings: {
      get: () => call("settings.get", {}),
      set: (values) => call("settings.set", { values })
    },
    net: {
      async fetch(url, init = {}) {
        const res = await call("net.fetch", { ...init, url });
        const text = res.text ?? "";
        return {
          status: res.status,
          ok: res.status >= 200 && res.status < 300,
          headers: res.headers,
          text,
          base64: res.base64 ?? null,
          json: () => JSON.parse(text)
        };
      }
    }
  };
}
// src/plugin.ts
class Plugin {
  api;
  context;
  root;
  #cleanups = [];
  #renders = [];
  #show;
  #serveBadges;
  #serveActions;
  #actions = new Map;
  constructor(host) {
    this.#show = host.show;
    this.#serveBadges = host.serveBadges;
    this.#serveActions = host.serveActions;
    this.api = createApi(host);
    this.context = host.context;
    this.root = host.root;
    const own = this.onunload;
    Object.defineProperty(this, "onunload", {
      value: () => {
        try {
          own.call(this);
        } finally {
          this.#unload();
        }
      }
    });
  }
  onunload() {}
  register(cleanup) {
    this.#cleanups.push(cleanup);
  }
  registerProjectView(view) {
    this.#renderSlot("projectView", view);
  }
  registerPage(page) {
    this.#renderSlot("page", page);
  }
  registerIssuePanel(panel) {
    this.#renderSlot("issuePanel", panel);
  }
  registerAction(action) {
    if (this.context.slot.kind !== "actions")
      return;
    if (this.#actions.size === 0)
      this.#serveActions?.((id, context) => {
        const run = this.#actions.get(id);
        if (!run)
          throw new Error(`No action "${id}"`);
        return run(context);
      });
    this.#actions.set(action.id, (context) => action.run(context));
  }
  registerBadges(badges) {
    if (this.context.slot.kind !== "badges")
      return;
    this.#serveBadges?.((issues) => badges.provide(issues));
  }
  registerWidget(widget) {
    this.#renderSlot("widget", widget);
  }
  registerSettings(page) {
    const { id } = this.context.slot;
    if (id === "settings" || id === "section")
      this.#renderSlot("settings", { ...page, id });
  }
  registerBlock(block) {
    const { slot } = this.context;
    if (slot.kind !== "block" || slot.id !== block.id)
      return;
    if (block.render) {
      this.#renderSlot("block", { id: block.id, render: block.render });
      return;
    }
    const data = block.data;
    if (!data)
      return;
    this.#renders.push(Promise.resolve(data(this.context)).then((d) => this.showBlock(d)));
  }
  showBlock(data) {
    this.#show?.(data);
  }
  #renderSlot(kind, view) {
    const { slot } = this.context;
    if (slot.kind !== kind || slot.id !== view.id)
      return;
    const done = Promise.resolve(view.render(this.root, this.context)).then((cleanup) => {
      if (typeof cleanup === "function")
        this.register(cleanup);
    });
    this.#renders.push(done);
  }
  async whenRendered() {
    await Promise.all(this.#renders);
  }
  registerInterval(callback, ms) {
    const id = setInterval(callback, ms);
    this.register(() => clearInterval(id));
    return id;
  }
  registerDomEvent(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.register(() => target.removeEventListener(type, listener, options));
  }
  loadSettings() {
    return this.api.settings.get();
  }
  #unload() {
    for (const cleanup of this.#cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {}
    }
  }
}
// src/tokens.ts
var TOKEN_NAMES = [
  "color.surface",
  "color.surface.sunken",
  "color.surface.raised",
  "color.surface.overlay",
  "color.surface.hovered",
  "color.surface.pressed",
  "color.text",
  "color.text.subtle",
  "color.text.inverse",
  "color.border",
  "color.border.strong",
  "color.focus",
  "color.primary",
  "color.primary.text",
  "color.primary.subtle",
  "color.primary.subtle.text",
  "color.secondary",
  "color.secondary.text",
  "color.secondary.subtle",
  "color.secondary.subtle.text",
  "color.danger",
  "color.danger.text",
  "color.danger.subtle",
  "color.danger.subtle.text",
  "color.warning",
  "color.success",
  "color.info",
  "color.blue",
  "color.teal",
  "color.green",
  "color.lime",
  "color.amber",
  "color.orange",
  "color.red",
  "color.purple",
  "color.indigo",
  "color.chart.1",
  "color.chart.2",
  "color.chart.3",
  "color.scrim",
  "font.family",
  "font.family.mono",
  "font.size.xxs",
  "font.size.xs",
  "font.size.sm",
  "font.size.base",
  "font.size.md",
  "font.size.lg",
  "font.size.xl",
  "font.size.2xl",
  "font.weight.regular",
  "font.weight.medium",
  "font.weight.semibold",
  "font.weight.bold",
  "line.height.tight",
  "line.height.normal",
  "line.height.loose",
  "space.0",
  "space.1",
  "space.2",
  "space.3",
  "space.4",
  "space.5",
  "space.6",
  "space.8",
  "space.10",
  "space.12",
  "radius.sm",
  "radius.md",
  "radius.lg",
  "radius.pill",
  "size.control",
  "size.control.sm",
  "size.touch",
  "shadow.card",
  "shadow.overlay",
  "opacity.disabled",
  "duration.fast",
  "duration.normal"
];
function token(name) {
  return `var(${tokenVariable(name)})`;
}
function tokenVariable(name) {
  return `--barynt-${name.replaceAll(".", "-")}`;
}
function tokenValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(tokenVariable(name)).trim();
}
function theme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function onThemeChange(callback) {
  const listener = () => callback(theme());
  window.addEventListener("barynt:themechange", listener);
  return () => window.removeEventListener("barynt:themechange", listener);
}
export {
  BaryntError,
  METHODS,
  Plugin,
  TOKEN_NAMES,
  createApi,
  onThemeChange,
  theme,
  token,
  tokenValue,
  tokenVariable
};
