import { describe, expect, it } from "bun:test";
import {
  isPrerelease,
  preferredVersion,
  splitVersions,
  updateTarget,
} from "@/lib/plugins/semver";

describe("releases and betas (BARY-237)", () => {
  it("knows a pre-release by its suffix", () => {
    expect(isPrerelease("1.0.0")).toBe(false);
    expect(isPrerelease("1.0.0-beta.1")).toBe(true);
    expect(isPrerelease("1.0.0-rc.2")).toBe(true);
    expect(isPrerelease("nonsense")).toBe(false);
  });

  it("splits into releases and betas, each newest first, whatever the order in", () => {
    expect(
      splitVersions([
        "0.9.0",
        "1.1.0-beta.2",
        "1.0.0",
        "1.1.0-beta.10",
        "0.8.0",
      ]),
    ).toEqual({
      releases: ["1.0.0", "0.9.0", "0.8.0"],
      prereleases: ["1.1.0-beta.10", "1.1.0-beta.2"],
    });
  });

  describe("preferredVersion", () => {
    it("is the newest release even when a newer beta exists", () => {
      expect(preferredVersion(["2.0.0-beta.1", "1.4.0", "1.3.0"])).toBe(
        "1.4.0",
      );
      expect(preferredVersion(["1.0.0-beta.3", "0.9.0"])).toBe("0.9.0");
    });

    it("is the newest beta when there is no release", () => {
      expect(preferredVersion(["0.1.0-beta.1", "0.1.0-beta.3"])).toBe(
        "0.1.0-beta.3",
      );
    });

    it("is nothing without versions", () => {
      expect(preferredVersion([])).toBeNull();
    });
  });

  describe("updateTarget", () => {
    const listed = ["1.2.0", "1.1.0", "1.0.0", "1.3.0-beta.1"];

    it("offers the newest release above the installed one, not a newer beta", () => {
      expect(updateTarget(listed, "1.0.0")).toBe("1.2.0");
    });

    it("offers a beta to nobody on a release", () => {
      expect(updateTarget(listed, "1.2.0")).toBeNull();
      expect(updateTarget(["1.0.0", "1.1.0-beta.1"], "1.0.0")).toBeNull();
    });

    it("offers someone on a beta the next beta, or a release when there is one", () => {
      expect(
        updateTarget(
          ["0.1.0-beta.1", "0.1.0-beta.2", "0.1.0-beta.3"],
          "0.1.0-beta.1",
        ),
      ).toBe("0.1.0-beta.3");
      expect(updateTarget(["0.1.0-beta.2", "0.1.0"], "0.1.0-beta.2")).toBe(
        "0.1.0",
      );
    });

    it("offers nothing when nothing is newer", () => {
      expect(updateTarget(["1.0.0", "0.9.0"], "1.0.0")).toBeNull();
      expect(updateTarget([], "1.0.0")).toBeNull();
    });
  });
});
