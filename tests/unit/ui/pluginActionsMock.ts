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
  installPlugin: mock(),
  listIssuePluginActions: mock(async () => null),
  previewRelease: mock(async () => ({ error: "test" })),
  refreshPluginSource: mock(),
  removePluginSource: mock(),
  rollbackPlugin: mock(),
  savePluginSettings: mock(),
  setPluginBlocked: mock(),
  setPluginGrant: mock(),
  uninstallPlugin: mock(),
  updatePluginSource: mock(),
});
