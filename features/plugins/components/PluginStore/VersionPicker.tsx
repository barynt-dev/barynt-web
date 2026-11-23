"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import {
  type ISelectItem,
  SelectMenu,
} from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { splitVersions } from "@/lib/plugins/semver";
import { usePluginText } from "../shared";

/**
 * The version to install (BARY-237), in the app's usual dropdown: the real
 * releases first, under their own heading, then the betas, each newest
 * first with the newest marked.
 */
export function VersionPicker({
  versions,
  value,
  onPick,
}: {
  versions: string[];
  value: string;
  onPick: (version: string) => void;
}) {
  const text = usePluginText();
  const { releases, prereleases } = splitVersions(versions);
  const items: ISelectItem[] = [
    ...releases.map((v, i) => ({
      value: v,
      label: `v${v}`,
      hint: i === 0 ? text.t("versionNewestHint") : undefined,
      group: text.t("versionGroupReleases"),
    })),
    ...prereleases.map((v, i) => ({
      value: v,
      label: `v${v}`,
      hint: i === 0 ? text.t("versionNewestHint") : undefined,
      group: text.t("versionGroupBetas"),
    })),
  ];

  return (
    <InlinePicker
      title={text.t("version")}
      width={260}
      align="end"
      trigger={
        <Button
          variant="outline"
          title={text.t("version")}
          iconRight={<Icon icon="lucide:chevron-down" width={14} />}
        >
          v{value}
        </Button>
      }
    >
      {(close) => (
        <SelectMenu
          items={items}
          value={value}
          onPick={(picked) => onPick(String(picked))}
          onClose={close}
          checkMark
        />
      )}
    </InlinePicker>
  );
}
