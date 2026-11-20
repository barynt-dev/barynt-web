// src/testing.ts
function createTestHost(options = {}) {
  const calls = [];
  const shown = [];
  let badgeHandler = null;
  let actionHandler = null;
  return {
    calls,
    shown,
    show: (data) => void shown.push(data),
    serveBadges: (handler) => {
      badgeHandler = handler;
    },
    badges: (issues) => badgeHandler?.(issues) ?? {},
    serveActions: (handler) => {
      actionHandler = handler;
    },
    runAction: async (id, context = { issueId: null }) => {
      if (!actionHandler)
        throw new Error("no actions registered");
      return await actionHandler(id, context) ?? {};
    },
    context: {
      slot: { kind: "projectView", id: "main" },
      workspaceId: "workspace",
      projectId: "project",
      locale: "en",
      ...options.context
    },
    root: options.root ?? (typeof document !== "undefined" ? document.createElement("div") : {}),
    async call(method, params) {
      calls.push({ method, params });
      const handler = options.handlers?.[method];
      if (!handler)
        throw new Error("capability_not_confirmed");
      return handler(params);
    }
  };
}
async function loadPlugin(PluginClass, host = createTestHost()) {
  const plugin = new PluginClass(host);
  await plugin.onload();
  await plugin.whenRendered();
  return { plugin, host, unload: () => plugin.onunload() };
}
export {
  createTestHost,
  loadPlugin
};
