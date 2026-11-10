import { describe, expect, it } from "bun:test";
import {
  assetUrl,
  authHeaders,
  detectProvider,
  directoryRequest,
  type GitRepo,
  parseGitRepo,
  releasePlan,
  repoUrl,
  resolvePluginRepo,
  sameInstance,
} from "@/lib/plugins/git-hosts";

const repo = (input: string, provider?: GitRepo["provider"]) =>
  parseGitRepo(input, provider) as GitRepo;

describe("reading a repository address (BARY-198)", () => {
  it("knows the big hosts and self-hosted ones by name", () => {
    const p = (u: string) => detectProvider(new URL(u));
    expect(p("https://github.com/a/b")).toBe("github");
    expect(p("https://gitlab.com/a/b")).toBe("gitlab");
    expect(p("https://codeberg.org/a/b")).toBe("gitea");
    expect(p("https://bitbucket.org/a/b")).toBe("bitbucket");
    expect(p("https://gitlab.acme.dev/a/b")).toBe("gitlab");
    expect(p("https://forgejo.acme.dev/a/b")).toBe("gitea");
    expect(p("https://plugins.acme.dev/plugins.json")).toBe("https");
    expect(p("https://git.acme.dev/a/b")).toBe(null);
  });

  it("normalizes .git, slashes and GitHub's short form", () => {
    expect(repoUrl(repo("acme/plugins"))).toBe(
      "https://github.com/acme/plugins",
    );
    expect(repoUrl(repo("https://www.github.com/acme/plugins.git"))).toBe(
      "https://github.com/acme/plugins",
    );
    expect(repo("https://gitlab.acme.dev/team/sub/plugins/").path).toBe(
      "team/sub/plugins",
    );
    expect(repo("https://git.acme.dev/team/plugins", "gitea").provider).toBe(
      "gitea",
    );
  });

  it("refuses what isn't a repository", () => {
    expect(parseGitRepo("http://github.com/a/b")).toBe(null);
    expect(parseGitRepo("https://user:pw@github.com/a/b")).toBe(null);
    expect(parseGitRepo("https://github.com/a/b/c")).toBe(null);
    expect(parseGitRepo("https://git.acme.dev/a/b")).toBe(null);
    expect(parseGitRepo("https://git.acme.dev/a/b", "bitbucket")).toBe(null);
    expect(parseGitRepo("https://gitlab.com/a/b?x=1")).toBe(null);
    expect(
      parseGitRepo("http://localhost:4555/a/b", "gitea", { allowHttp: true })
        ?.origin,
    ).toBe("http://localhost:4555");
  });
});

describe("where the directory is", () => {
  it("per provider, at the default branch or a ref", () => {
    const at = (r: GitRepo, ref: string | null, token = false) =>
      directoryRequest(r, ref, token).url.href;
    expect(at(repo("acme/p"), null)).toBe(
      "https://raw.githubusercontent.com/acme/p/HEAD/plugins.json",
    );
    expect(at(repo("acme/p"), "main", true)).toBe(
      "https://api.github.com/repos/acme/p/contents/plugins.json?ref=main",
    );
    expect(at(repo("https://gitlab.acme.dev/team/sub/p"), "v2")).toBe(
      "https://gitlab.acme.dev/api/v4/projects/team%2Fsub%2Fp/repository/files/plugins.json/raw?ref=v2",
    );
    expect(at(repo("https://codeberg.org/n/p"), null)).toBe(
      "https://codeberg.org/api/v1/repos/n/p/raw/plugins.json",
    );
    expect(at(repo("https://bitbucket.org/w/p"), null)).toBe(
      "https://api.bitbucket.org/2.0/repositories/w/p/src/main/plugins.json",
    );
    expect(at(repo("https://cdn.acme.dev/x/plugins.json"), "ignored")).toBe(
      "https://cdn.acme.dev/x/plugins.json",
    );
  });
});

describe("where a release's files are", () => {
  it("one address per file, or the release's metadata first", () => {
    const direct = (r: GitRepo, token = false) => {
      const plan = releasePlan(r, "1.2.0", token);
      return plan.kind === "direct" ? plan.url("main.js").href : plan.kind;
    };
    expect(direct(repo("acme/x"))).toBe(
      "https://github.com/acme/x/releases/download/1.2.0/main.js",
    );
    expect(direct(repo("acme/x"), true)).toBe("metadata");
    expect(direct(repo("https://codeberg.org/n/x"))).toBe(
      "https://codeberg.org/n/x/releases/download/1.2.0/main.js",
    );
    expect(direct(repo("https://gitlab.com/g/x"))).toBe("metadata");
    expect(direct(repo("https://bitbucket.org/w/x"))).toBe(
      "https://api.bitbucket.org/2.0/repositories/w/x/src/1.2.0/main.js",
    );
    expect(direct(repo("https://cdn.acme.dev/x", "https"))).toBe(
      "https://cdn.acme.dev/x/1.2.0/main.js",
    );
  });

  it("takes GitHub assets only from api.github.com", () => {
    const gh = repo("acme/x");
    const meta = (url: string) => ({ assets: [{ name: "main.js", url }] });
    expect(
      assetUrl(
        gh,
        meta("https://api.github.com/repos/acme/x/releases/assets/1"),
        "main.js",
      )?.url.href,
    ).toBe("https://api.github.com/repos/acme/x/releases/assets/1");
    expect(assetUrl(gh, meta("https://evil.example/steal"), "main.js")).toBe(
      null,
    );
    expect(assetUrl(gh, meta("https://api.github.com/x"), "styles.css")).toBe(
      null,
    );
    expect(assetUrl(gh, null, "main.js")).toBe(null);
  });

  it("sends the token along only on the instance's own origin", () => {
    const gl = repo("https://gitlab.acme.dev/g/x");
    const links = (url: string) => ({
      assets: { links: [{ name: "main.js", direct_asset_url: url }] },
    });
    expect(
      assetUrl(
        gl,
        links("https://gitlab.acme.dev/g/x/-/releases/1.2.0/downloads/main.js"),
        "main.js",
      )?.withToken,
    ).toBe(true);
    const away = assetUrl(
      gl,
      links("https://s3.example.com/main.js"),
      "main.js",
    );
    expect(away?.withToken).toBe(false);
    expect(
      assetUrl(gl, links("http://s3.example.com/main.js"), "main.js"),
    ).toBe(null);
    const gitea = repo("https://codeberg.org/n/x");
    expect(
      assetUrl(
        gitea,
        {
          assets: [
            {
              name: "main.js",
              browser_download_url: "https://codeberg.org/attachments/1",
            },
          ],
        },
        "main.js",
      )?.withToken,
    ).toBe(true);
  });
});

describe("tokens", () => {
  it("travel the way each provider expects", () => {
    expect(authHeaders("github", "t")).toEqual({ authorization: "Bearer t" });
    expect(authHeaders("gitlab", "t")).toEqual({ "private-token": "t" });
    expect(authHeaders("gitea", "t")).toEqual({ authorization: "token t" });
    expect(authHeaders("bitbucket", "me:pw")).toEqual({
      authorization: `Basic ${Buffer.from("me:pw").toString("base64")}`,
    });
    expect(authHeaders("github", null)).toBeUndefined();
  });

  it("belong to one instance", () => {
    expect(sameInstance(repo("acme/a"), repo("https://github.com/b/c"))).toBe(
      true,
    );
    expect(
      sameInstance(
        repo("https://gitlab.com/a/b"),
        repo("https://gitlab.acme.dev/a/b"),
      ),
    ).toBe(false);
  });
});

describe("where a directory's plugin lives", () => {
  const source = repo("https://git.acme.dev/team/plugins", "gitea");
  const at = (entry: { repo: string; provider?: GitRepo["provider"] }) =>
    resolvePluginRepo(entry, source);

  it("GitHub for owner/name, the source's provider on its host", () => {
    expect(at({ repo: "acme/x" })?.provider).toBe("github");
    expect(at({ repo: "https://git.acme.dev/team/x" })?.provider).toBe("gitea");
    expect(at({ repo: "https://gitlab.com/g/x" })?.provider).toBe("gitlab");
    expect(at({ repo: "https://cdn.acme.dev/x" })?.provider).toBe("https");
    expect(
      at({ repo: "https://code.other.dev/g/x", provider: "gitlab" })?.provider,
    ).toBe("gitlab");
    expect(at({ repo: "http://git.acme.dev/team/x" })).toBe(null);
  });
});
