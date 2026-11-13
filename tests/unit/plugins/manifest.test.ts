import { describe, expect, it } from "bun:test";
import {
  CAPABILITIES,
  isCompatible,
  validateManifest,
} from "@/lib/plugins/manifest";
import { compareSemver, parseSemver } from "@/lib/plugins/semver";

const base = {
  id: "gantt-timeline",
  name: "Gantt Timeline",
  version: "1.2.0",
  minBaryntVersion: "0.1.0",
  author: "Acme GmbH",
  description: "Issues on a timeline.",
  license: "MIT",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["issues:read", "ui:project-view"],
  network: [],
  contributes: { projectViews: [{ id: "timeline", title: "Timeline" }] },
};

function errors(input: unknown) {
  const r = validateManifest(input);
  return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`);
}

describe("validateManifest", () => {
  it("accepts a complete sandbox plugin", () => {
    const r = validateManifest(base);
    expect(r.ok).toBe(true);
  });

  it("accepts a declarative plugin with fields and a badge", () => {
    const r = validateManifest({
      ...base,
      id: "customer-info",
      kind: "declarative",
      levels: ["workspace", "project"],
      capabilities: ["fields:write", "ui:issue-badge"],
      contributes: {
        fields: [{ key: "customer", name: "Customer", type: "TEXT" }],
        issueBadges: [{ id: "customer", title: "Customer" }],
      },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(errors({ ...base, homepage: "x" }).length).toBeGreaterThan(0);
    expect(
      errors({ ...base, contributes: { ...base.contributes, widgets: [] } })
        .length,
    ).toBeGreaterThan(0);
  });

  it("rejects an unknown field inside a contribution", () => {
    const e = errors({
      ...base,
      contributes: {
        projectViews: [
          { id: "timeline", title: "Timeline", url: "https://x.y" },
        ],
      },
    });
    expect(e.length).toBeGreaterThan(0);
  });

  it("takes up to six previews with flat image names (BARY-199)", () => {
    const p = (file: string) => ({ file, title: "Shot" });
    expect(
      errors({ ...base, previews: [p("preview-1.webp"), p("preview-2.png")] }),
    ).toEqual([]);
    expect(
      errors({ ...base, previews: [p("previews/1.webp")] }).length,
    ).toBeGreaterThan(0);
    expect(
      errors({ ...base, previews: [p("preview-1.svg")] }).length,
    ).toBeGreaterThan(0);
    expect(
      errors({
        ...base,
        previews: [p("preview-1.png"), p("preview-1.png")],
      })[0],
    ).toContain("unique");
    expect(
      errors({
        ...base,
        previews: [1, 2, 3, 4, 5, 6, 1].map((n, i) =>
          p(`preview-${n}.${i < 6 ? "png" : "webp"}`),
        ),
      }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects an unknown capability", () => {
    expect(
      errors({ ...base, capabilities: ["issues:read", "db:everything"] })
        .length,
    ).toBeGreaterThan(0);
  });

  it("rejects a reserved or malformed id", () => {
    expect(errors({ ...base, id: "core" })[0]).toContain("reserved");
    expect(errors({ ...base, id: "Bad_Id" }).length).toBeGreaterThan(0);
    expect(errors({ ...base, id: "a" }).length).toBeGreaterThan(0);
  });

  it("requires the capability a contribution needs", () => {
    const e = errors({ ...base, capabilities: ["issues:read"] });
    expect(e.join()).toContain("ui:project-view");
  });

  it("keeps a declarative plugin free of code and hosts", () => {
    const e = errors({
      ...base,
      kind: "declarative",
      network: ["api.example.com"],
    });
    expect(e.join()).toContain("cannot call hosts");
    const f = errors({ ...base, kind: "declarative" });
    expect(f.join()).toContain("cannot contribute projectViews");
  });

  it("keeps a service out of the browser surface", () => {
    const e = errors({
      ...base,
      kind: "service",
      network: ["api.acme.example"],
    });
    expect(e.join()).toContain("cannot contribute projectViews");
  });

  it("rejects hosts with scheme, path, port or wildcard", () => {
    for (const host of [
      "https://api.example.com",
      "api.example.com/v1",
      "api.example.com:8080",
      "*.example.com",
      "localhost",
      "10.0.0.1",
    ]) {
      expect(errors({ ...base, network: [host] }).length).toBeGreaterThan(0);
    }
    expect(errors({ ...base, network: ["gitlab.com"] })).toEqual([]);
  });

  it("rejects duplicate ids within a list", () => {
    const e = errors({
      ...base,
      contributes: {
        projectViews: [
          { id: "timeline", title: "A" },
          { id: "timeline", title: "B" },
        ],
      },
    });
    expect(e.join()).toContain("unique");
  });

  it("needs options for a choice field and rejects them elsewhere", () => {
    const mk = (field: object) =>
      errors({
        ...base,
        kind: "declarative",
        capabilities: ["fields:write"],
        contributes: { fields: [field] },
      });
    expect(mk({ key: "size", name: "Size", type: "SELECT" }).join()).toContain(
      "needs options",
    );
    expect(
      mk({
        key: "size",
        name: "Size",
        type: "TEXT",
        options: [{ id: "s", label: "S" }],
      }).join(),
    ).toContain("only choice fields");
  });

  it("checks the version order", () => {
    expect(
      errors({
        ...base,
        minBaryntVersion: "0.5.0",
        maxBaryntVersion: "0.2.0",
      })[0],
    ).toContain("lower than");
    expect(errors({ ...base, version: "1.2" }).length).toBeGreaterThan(0);
  });

  it("requires author and license", () => {
    const { author: _a, ...noAuthor } = base;
    const { license: _l, ...noLicense } = base;
    expect(errors(noAuthor).length).toBeGreaterThan(0);
    expect(errors(noLicense).length).toBeGreaterThan(0);
  });

  it("never throws on junk", () => {
    for (const junk of [null, undefined, 5, "x", [], {}]) {
      expect(() => validateManifest(junk)).not.toThrow();
      expect(validateManifest(junk).ok).toBe(false);
    }
  });

  it("lists every capability exactly once", () => {
    expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length);
  });
});

describe("isCompatible", () => {
  it("honours the lowest and the highest version", () => {
    const m = { minBaryntVersion: "0.2.0", maxBaryntVersion: "0.4.0" };
    expect(isCompatible(m, "0.1.9")).toBe(false);
    expect(isCompatible(m, "0.2.0")).toBe(true);
    expect(isCompatible(m, "0.4.0")).toBe(true);
    expect(isCompatible(m, "0.4.1")).toBe(false);
    expect(isCompatible({ minBaryntVersion: "0.2.0" }, "3.0.0")).toBe(true);
  });
});

describe("semver", () => {
  it("parses and orders versions", () => {
    expect(parseSemver("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: null,
    });
    expect(parseSemver("01.2.3")).toBeNull();
    expect(parseSemver("1.2")).toBeNull();
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
    expect(compareSemver("1.0.0-alpha.2", "1.0.0-alpha.10")).toBeLessThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(() => compareSemver("x", "1.0.0")).toThrow();
  });
});

describe("credentials (BARY-147)", () => {
  const withCredential = (credential: Record<string, unknown>, extra = {}) => ({
    ...base,
    network: ["gitlab.example.com"],
    ...extra,
    contributes: {
      ...base.contributes,
      credentials: [
        {
          key: "token",
          label: "Access token",
          level: "user",
          host: "gitlab.example.com",
          ...credential,
        },
      ],
    },
  });

  it("accepts one for a host in network, with Bearer as the default", () => {
    const r = validateManifest(withCredential({}));
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.manifest.contributes.credentials?.[0]).toMatchObject({
        header: "Authorization",
        format: "Bearer {value}",
      });
  });

  it("needs its host in network", () => {
    expect(errors(withCredential({ host: "other.example.com" }))).toContain(
      "contributes.credentials.0.host: the host must be in network",
    );
  });

  it("keeps a workspace's or project's credential to the plugin's levels", () => {
    expect(errors(withCredential({ level: "workspace" }))).toContain(
      "contributes.credentials.0.level: the plugin has no workspace level",
    );
    expect(errors(withCredential({ level: "project" }))).toEqual([]);
  });

  it("needs {value} in its format, and no header Barynt sets itself", () => {
    expect(errors(withCredential({ format: "Bearer token" })).join()).toContain(
      "{value}",
    );
    expect(errors(withCredential({ header: "Cookie" }))).toContain(
      "contributes.credentials.0.header: Barynt sets this header itself",
    );
  });

  it("is for code only: a service has its own server", () => {
    expect(
      errors({
        ...withCredential({}),
        kind: "service",
        contributes: {
          credentials: withCredential({}).contributes.credentials,
        },
      }),
    ).toContain(
      "contributes.credentials: a service plugin cannot contribute credentials",
    );
  });
});

describe("settingsPage (BARY-149)", () => {
  it("lets a sandbox plugin with settings draw them itself", () => {
    expect(
      errors({
        ...base,
        contributes: {
          ...base.contributes,
          settings: [{ key: "zoom", type: "number", label: "Zoom" }],
          settingsPage: true,
        },
      }),
    ).toEqual([]);
  });

  it("needs settings to save, and code to draw them", () => {
    expect(
      errors({
        ...base,
        contributes: { ...base.contributes, settingsPage: true },
      }),
    ).toContain(
      "contributes.settingsPage: needs settings to save — the page draws them, Barynt keeps them",
    );
    expect(
      errors({
        ...base,
        kind: "service",
        capabilities: [],
        contributes: {
          settings: [{ key: "zoom", type: "number", label: "Zoom" }],
          settingsPage: true,
        },
      }),
    ).toContain(
      "contributes.settingsPage: a service plugin cannot have settingsPage",
    );
  });
});

describe("widgetTemplates (BARY-203)", () => {
  const template = {
    id: "bugs",
    title: "Open bugs",
    blocks: [
      { type: "kpi", config: { metric: "open" } },
      { type: "issues", config: { sort: "priority" } },
    ],
  };

  it("lets any kind bring templates of Barynt's blocks", () => {
    for (const kind of ["sandbox", "declarative", "service"])
      expect(
        errors({
          ...base,
          kind,
          capabilities: ["ui:dashboard-widget"],
          contributes: { widgetTemplates: [template] },
        }),
      ).toEqual([]);
  });

  it("checks the blocks like a custom widget, and the capability", () => {
    expect(
      errors({
        ...base,
        contributes: { ...base.contributes, widgetTemplates: [template] },
      }),
    ).toContain(
      "contributes.widgetTemplates: needs the capability ui:dashboard-widget",
    );
    const bad = (t: unknown) =>
      errors({
        ...base,
        capabilities: ["ui:dashboard-widget"],
        contributes: { widgetTemplates: [t] },
      });
    expect(bad({ ...template, blocks: [] })).not.toEqual([]);
    expect(bad({ ...template, blocks: [{ type: "note" }] })).not.toEqual([]);
    expect(
      bad({ ...template, blocks: [{ type: "kpi", config: { colour: 1 } }] }),
    ).not.toEqual([]);
    expect(bad({ ...template, size: "W" })).not.toEqual([]);
  });

  it("keeps template ids apart from the drawn widgets'", () => {
    expect(
      errors({
        ...base,
        capabilities: ["ui:dashboard-widget"],
        contributes: {
          dashboardWidgets: [{ id: "bugs", title: "Bugs" }],
          widgetTemplates: [template],
        },
      }),
    ).toContain(
      "contributes.widgetTemplates.0.id: already the id of one of dashboardWidgets",
    );
  });
});

describe("more setting types and a settings section (BARY-204)", () => {
  const withSettings = (settings: unknown[], more: object = {}) =>
    errors({
      ...base,
      contributes: { ...base.contributes, settings, ...more },
    });

  it("accepts every type", () => {
    expect(
      withSettings([
        { key: "body", type: "textarea", label: "Body" },
        { key: "link", type: "url", label: "Link" },
        {
          key: "days",
          type: "multiselect",
          label: "Days",
          options: [{ id: "mon", label: "Mon" }],
          default: ["mon"],
        },
        { key: "who", type: "member", label: "Who" },
        { key: "tag", type: "label", label: "Tag" },
      ]),
    ).toEqual([]);
  });

  it("needs options of its own only for select and multiselect", () => {
    expect(
      withSettings([{ key: "days", type: "multiselect", label: "Days" }]),
    ).toContain(
      "contributes.settings.0.options: a multiselect setting needs options",
    );
    expect(
      withSettings([
        {
          key: "who",
          type: "member",
          label: "Who",
          options: [{ id: "u1", label: "Ada" }],
        },
      ]),
    ).toContain(
      "contributes.settings.0.options: only select and multiselect settings have options",
    );
  });

  it("keeps lists as defaults to multiselects", () => {
    expect(
      withSettings([
        { key: "body", type: "text", label: "Body", default: ["x"] },
      ]),
    ).toContain(
      "contributes.settings.0.default: only a multiselect's default is a list",
    );
  });

  it("takes a section below Barynt's form", () => {
    expect(
      withSettings([{ key: "zoom", type: "number", label: "Zoom" }], {
        settingsPage: "section",
      }),
    ).toEqual([]);
    expect(
      withSettings([{ key: "zoom", type: "number", label: "Zoom" }], {
        settingsPage: "below",
      }),
    ).not.toEqual([]);
  });
});

describe("widgetBlocks (BARY-205)", () => {
  const withBlocks = (widgetBlocks: unknown[], over: object = {}) =>
    errors({
      ...base,
      capabilities: ["ui:dashboard-widget"],
      contributes: { widgetBlocks },
      ...over,
    });

  it("lets a sandbox plugin bring blocks, with settings", () => {
    expect(
      withBlocks([
        {
          id: "due-soon",
          title: "Due soon",
          settings: [{ key: "days", type: "number", label: "Days" }],
        },
        { id: "ring", title: "Done", draw: "plugin" },
      ]),
    ).toEqual([]);
  });

  it("needs code, the capability, and simple settings", () => {
    expect(
      withBlocks([{ id: "x", title: "X" }], { kind: "declarative" }),
    ).toContain(
      "contributes.widgetBlocks: a declarative plugin cannot contribute widgetBlocks",
    );
    expect(
      errors({
        ...base,
        contributes: { widgetBlocks: [{ id: "x", title: "X" }] },
      }),
    ).toContain(
      "contributes.widgetBlocks: needs the capability ui:dashboard-widget",
    );
    expect(
      withBlocks([
        {
          id: "x",
          title: "X",
          settings: [{ key: "who", type: "member", label: "Who" }],
        },
      ]),
    ).not.toEqual([]);
    expect(
      withBlocks([
        {
          id: "x",
          title: "X",
          settings: [{ key: "pick", type: "select", label: "Pick" }],
        },
      ]),
    ).toContain(
      "contributes.widgetBlocks.0.settings.0.options: a select setting needs options",
    );
  });
});

describe("issue panels in the sidebar (BARY-209)", () => {
  it("takes main or sidebar, nothing else", () => {
    const panels = (placement: unknown) =>
      errors({
        ...base,
        capabilities: ["ui:issue-panel"],
        contributes: {
          issuePanels: [{ id: "dev", title: "Development", placement }],
        },
      });
    expect(panels("sidebar")).toEqual([]);
    expect(panels("main")).toEqual([]);
    expect(panels("footer")).not.toEqual([]);
  });
});
