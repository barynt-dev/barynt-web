"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { SheetHeader } from "@/components/ui/layout/Modal/components/SheetHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { useSwipeToClose } from "@/lib/utils/useSwipeToClose";
import styles from "./plugins.module.scss";

// What the plugin pages share (BARY-143): the words for capabilities, kinds,
// levels and errors, the list a dialog shows before anyone confirms, and a
// window that is a dialog from a tablet up and a bottom sheet on a phone.

const KNOWN_ERRORS = [
  "not_found",
  "name_required",
  "invalid_url",
  "source_exists",
  "already_installed",
  "blocked",
  "capabilities_not_confirmed",
  "not_listed",
  "download_failed",
  "hash_mismatch",
  "invalid_manifest",
  "id_mismatch",
  "version_mismatch",
  "kind_mismatch",
  "incompatible",
  "source",
  "not_in_directory",
  "no_previous_version",
  "not_active",
  "not_blocked",
  "not_installed",
  "level_not_allowed",
  "not_granted",
  "not_activated",
  "disabled",
  "unreachable",
  "not_json",
  "token_unreadable",
  "provider_required",
  "invalid_ref",
] as const;

export function usePluginText() {
  const t = useTranslations("plugins");
  return {
    t,
    /** "Read issues" for `issues:read`; the key itself for one it doesn't know. */
    capability: (cap: string) =>
      t.has(`cap.${cap}` as "cap.issues:read")
        ? t(`cap.${cap}` as "cap.issues:read")
        : cap,
    kind: (kind: string) =>
      t.has(`kind.${kind}` as "kind.sandbox")
        ? t(`kind.${kind}` as "kind.sandbox")
        : kind,
    kindHint: (kind: string) =>
      t.has(`kindHint.${kind}` as "kindHint.sandbox")
        ? t(`kindHint.${kind}` as "kindHint.sandbox")
        : "",
    level: (level: string) =>
      t.has(`level.${level}` as "level.project")
        ? t(`level.${level}` as "level.project")
        : level,
    error: (code: string) =>
      (KNOWN_ERRORS as readonly string[]).includes(code)
        ? t(`error.${code}` as "error.not_found")
        : t("error.unknown", { code }),
  };
}

/** Kind and levels as small badges. */
export function PluginBadges({
  kind,
  levels,
}: {
  kind: string;
  levels: string[];
}) {
  const text = usePluginText();
  return (
    <span className={styles.badges}>
      <span title={text.kindHint(kind)}>
        <Badge size="sm" mono={false}>
          {text.kind(kind)}
        </Badge>
      </span>
      {levels.map((level) => (
        <Badge key={level} size="sm" mono={false}>
          {text.level(level)}
        </Badge>
      ))}
    </span>
  );
}

/**
 * What a plugin may do once confirmed — and, under it, the hosts its code
 * may call. `highlight` marks the capabilities an update added.
 */
export function CapabilityList({
  capabilities,
  network = [],
  highlight = [],
}: {
  capabilities: string[];
  network?: string[];
  highlight?: string[];
}) {
  const text = usePluginText();
  return (
    <div className={styles.capabilities}>
      {capabilities.length === 0 ? (
        <p className={styles.muted}>{text.t("noCapabilities")}</p>
      ) : (
        <ul className={styles.capList}>
          {capabilities.map((cap) => (
            <li
              key={cap}
              className={styles.cap}
              data-new={highlight.includes(cap) || undefined}
            >
              <Icon icon="lucide:shield-check" width={14} aria-hidden />
              <span>{text.capability(cap)}</span>
              <code>{cap}</code>
              {highlight.includes(cap) && (
                <Badge size="sm" mono={false} active>
                  {text.t("newCapability")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {network.length > 0 && (
        <div className={styles.hosts}>
          <span className={styles.fieldLabel}>{text.t("networkHosts")}</span>
          <span className={styles.hostList}>
            {network.map((host) => (
              <code key={host}>{host}</code>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** A dialog from a tablet up, a bottom sheet on a phone (`sheet`). */
export function PluginDialog({
  title,
  sheet,
  close,
  children,
  footer,
}: {
  title: string;
  sheet: boolean;
  close: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useTranslations();
  const bodyRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeToClose(close, bodyRef);
  return (
    <Modal
      variant={sheet ? "sheet" : "dialog"}
      style={sheet ? swipe.style : undefined}
      {...(sheet ? swipe.handlers : {})}
    >
      {sheet ? (
        <SheetHeader
          title={title}
          onClose={close}
          closeLabel={t("actions.close")}
        />
      ) : (
        <ModalHeader
          title={title}
          onClose={close}
          closeLabel={t("actions.close")}
        />
      )}
      <ModalBody ref={bodyRef} className={styles.dialogBody}>
        {children}
      </ModalBody>
      <ModalFooter>{footer}</ModalFooter>
    </Modal>
  );
}

/**
 * A plugin's screenshots as a row that scrolls sideways (BARY-199).
 * Nothing when the plugin has none.
 */
export function PreviewStrip({
  previews,
}: {
  previews: { title: string; src: string }[];
}) {
  if (previews.length === 0) return null;
  return (
    <ul className={styles.previews}>
      {previews.map((p) => (
        <li key={p.src}>
          <figure>
            {/* biome-ignore lint/performance/noImgElement: stored or inline plugin images, nothing for next/image to optimize */}
            <img src={p.src} alt={p.title} loading="lazy" decoding="async" />
            <figcaption>{p.title}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/** An error line, as the settings pages show them. */
export function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className={styles.error} role="alert">
      <Icon icon="lucide:circle-alert" width={14} />
      {message}
    </p>
  );
}
