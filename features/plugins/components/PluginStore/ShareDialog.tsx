"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { CopyButton } from "@/components/ui/layout/CopyButton/CopyButton";
import {
  embedHtml,
  SHARE_NAMES,
  SHARE_NETWORKS,
  type ShareNetwork,
  shareText,
  shareUrl,
} from "@/lib/plugins/share";
import { PluginDialog, usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

const ICONS: Record<ShareNetwork, string> = {
  linkedin: "mdi:linkedin",
  x: "logos:x",
  facebook: "mdi:facebook",
  whatsapp: "mdi:whatsapp",
  telegram: "mdi:telegram",
  reddit: "mdi:reddit",
  xing: "mdi:xing",
  bluesky: "logos:bluesky",
};

/**
 * What to take along when sharing a plugin (BARY-237): its address to
 * copy, HTML to put it on a website, and the eight networks a company
 * shares on. Where the browser has a share sheet of its own, it's offered
 * as well, for every app the list doesn't have.
 */
export function ShareDialog({
  name,
  description,
  url,
  isPublic,
  sheet,
  close,
}: {
  name: string;
  description: string;
  /** What's shared: the plugin's own address, else this page's. */
  url: string;
  /** Whether `url` is the plugin's own — else it only opens signed in. */
  isPublic: boolean;
  sheet: boolean;
  close: () => void;
}) {
  const t = useTranslations();
  const text = usePluginText();
  const message = shareText(name, description);
  const html = embedHtml({
    url,
    name,
    description,
    cta: text.t("shareEmbedCta"),
  });
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareNatively = async () => {
    try {
      await navigator.share({ title: name, text: message, url });
      close();
    } catch {
      // Closing the sheet isn't a failure, and there's nothing else to do.
    }
  };

  return (
    <PluginDialog
      title={text.t("shareTitle", { name })}
      sheet={sheet}
      close={close}
      footer={
        <>
          {canShare && (
            <Button
              variant="outline"
              icon={<Icon icon="lucide:share-2" width={15} />}
              onClick={shareNatively}
            >
              {text.t("shareMore")}
            </Button>
          )}
          {!sheet && (
            <Button variant="ghost" onClick={close}>
              {t("actions.close")}
            </Button>
          )}
        </>
      }
    >
      <section className={styles.shareSection}>
        <h3 className={styles.shareHead}>{text.t("shareLink")}</h3>
        <CopyField
          value={url}
          copyLabel={text.t("shareCopy")}
          copiedLabel={text.t("shareCopied")}
        />
        <p className={styles.shareHint} data-warn={isPublic ? undefined : ""}>
          {text.t(isPublic ? "shareLinkPublic" : "shareLinkPage")}
        </p>
      </section>

      <section className={styles.shareSection}>
        <h3 className={styles.shareHead}>{text.t("shareEmbed")}</h3>
        <p className={styles.shareHint}>{text.t("shareEmbedHint")}</p>
        <div className={styles.shareCode}>
          <div className={styles.shareCodeBar}>
            <span>HTML</span>
            <CopyButton
              value={html}
              label={text.t("shareCopy")}
              copiedLabel={text.t("shareCopied")}
            />
          </div>
          <pre>{html}</pre>
        </div>
      </section>

      <section className={styles.shareSection}>
        <h3 className={styles.shareHead}>{text.t("shareSocial")}</h3>
        <ul className={styles.shareNetworks}>
          {SHARE_NETWORKS.map((network) => (
            <li key={network}>
              <a
                className={styles.shareNetwork}
                href={shareUrl(network, { url, text: message, title: name })}
                target="_blank"
                rel="noopener noreferrer"
                title={text.t("shareOn", { network: SHARE_NAMES[network] })}
              >
                <Icon
                  icon={ICONS[network]}
                  width={22}
                  height={22}
                  aria-hidden
                />
                <span>{SHARE_NAMES[network]}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </PluginDialog>
  );
}
