"use client";

import { Icon } from "@iconify/react";
import { usePluginText } from "@/features/plugins/components/shared";
import styles from "./repoBadges.module.scss";

// What a repository is, at a glance (BARY-238): who sees it, whether it's
// archived, a fork, or out of reach — small tags beside its name, the same
// in the workspace's overview and a project's picker.

export interface RepoFacts {
  visibility?: "public" | "private" | "internal";
  archived?: boolean;
  fork?: boolean;
  unreachable?: boolean;
}

export function RepoBadges({ repo }: { repo: RepoFacts }) {
  const text = usePluginText();
  const tags: { key: string; icon: string; label: string; tone?: string }[] =
    [];
  if (repo.unreachable)
    tags.push({
      key: "unreachable",
      icon: "lucide:circle-alert",
      label: text.t("github.unreachable"),
      tone: "warning",
    });
  if (repo.visibility === "private")
    tags.push({
      key: "private",
      icon: "lucide:lock",
      label: text.t("github.private"),
    });
  if (repo.visibility === "internal")
    tags.push({
      key: "internal",
      icon: "lucide:building-2",
      label: text.t("github.internal"),
    });
  if (repo.visibility === "public")
    tags.push({
      key: "public",
      icon: "lucide:globe",
      label: text.t("github.public"),
    });
  if (repo.archived)
    tags.push({
      key: "archived",
      icon: "lucide:archive",
      label: text.t("github.archived"),
      tone: "warning",
    });
  if (repo.fork)
    tags.push({
      key: "fork",
      icon: "lucide:git-fork",
      label: text.t("github.fork"),
    });
  if (tags.length === 0) return null;
  return (
    <span className={styles.tags}>
      {tags.map((t) => (
        <span key={t.key} className={styles.tag} data-tone={t.tone}>
          <Icon icon={t.icon} width={12} aria-hidden />
          {t.label}
        </span>
      ))}
    </span>
  );
}

/** `owner/` quiet, the name strong — what tells repositories apart. */
export function RepoName({ fullName }: { fullName: string }) {
  const slash = fullName.indexOf("/");
  return (
    <span className={styles.name}>
      <span className={styles.owner}>{fullName.slice(0, slash + 1)}</span>
      <span className={styles.repo}>{fullName.slice(slash + 1)}</span>
    </span>
  );
}
