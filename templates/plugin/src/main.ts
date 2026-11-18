import { Plugin } from "@barynt/plugin-sdk";
import { openIssues } from "./open";

// One class, exported as the default: Barynt creates it in the plugin's
// frame and calls `onload()`. What's registered here is undone on its own
// when the plugin unloads.
export default class OpenIssues extends Plugin {
  async onload() {
    this.registerProjectView({
      // The id from `contributes.projectViews` in manifest.json.
      id: "open",
      render: async (el) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        const list = document.createElement("ul");
        list.className = "open-issues";
        for (const issue of openIssues(issues)) {
          const item = document.createElement("li");
          // `textContent`, never `innerHTML`: a title is text someone typed.
          item.textContent = `${issue.ref} · ${issue.title}`;
          list.append(item);
        }
        el.replaceChildren(list);
      },
    });
  }
}
