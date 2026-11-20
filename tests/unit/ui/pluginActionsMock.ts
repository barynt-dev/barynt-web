import { mock } from "bun:test";

/** `@/features/plugins/actions` without a server: every export the plugin
 *  pages import, so whichever UI test registers it first, the others find
 *  theirs too (they share a process). */
export const pluginActionsMock = () => ({
  activatePlugin: mock(),
  addPluginSource: mock(),
  checkPluginSource: mock(),
  deactivatePlugin: mock(),
  deletePluginData: mock(),
  installDevPlugin: mock(),
  installPlugin: mock(),
  listPluginDeliveries: mock(async () => []),
  listIssuePluginActions: mock(async () => null),
  previewRelease: mock(async () => ({ error: "test" })),
  refreshPluginSource: mock(),
  removePluginSource: mock(),
  resumePluginService: mock(async () => ({ ok: true })),
  rollbackPlugin: mock(),
  savePluginSettings: mock(),
  setPluginBlocked: mock(),
  setPluginGrant: mock(),
  setPluginServiceAddress: mock(async () => ({ ok: true })),
  setActivationServiceAddress: mock(async () => ({ ok: true })),
  setInboundRule: mock(async () => ({ ok: true })),
  testPluginService: mock(async () => ({ ok: true })),
  uninstallPlugin: mock(),
  updatePluginSource: mock(),
});
