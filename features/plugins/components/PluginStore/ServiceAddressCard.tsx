"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { setPluginServiceAddress } from "@/features/plugins/actions";
import type { InstalledPlugin } from "@/features/plugins/queries";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/**
 * Where the server of a plugin the operator runs is (`platform`, BARY-223)
 * — a container beside Barynt, say. Saving tells every place the plugin is
 * on; set by `PLUGIN_SERVICE_URLS`, it's only shown.
 */
export function ServiceAddressCard({ plugin }: { plugin: InstalledPlugin }) {
  const text = usePluginText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const address = plugin.serviceAddress;
  if (!address) return null;

  const save = (form: FormData) =>
    startTransition(async () => {
      const result = await setPluginServiceAddress({
        pluginId: plugin.pluginId,
        url: String(form.get("url") ?? ""),
      });
      setError("error" in result ? result.error : null);
      router.refresh();
    });

  return (
    <section className={styles.card} aria-labelledby="plugin-server-address">
      <h3 id="plugin-server-address" className={styles.cardTitle}>
        <Icon icon="lucide:server" width={14} aria-hidden />
        {text.t("serverAddress.title")}
      </h3>
      {address.fromEnv ? (
        <>
          <code className={styles.host}>{address.url}</code>
          <p className={styles.muted}>{text.t("serverAddress.fromEnv")}</p>
        </>
      ) : (
        <form action={save} className={styles.serverForm}>
          <Input
            name="url"
            variant="url"
            label={text.t("serverAddress.label")}
            defaultValue={address.url ?? ""}
            placeholder={plugin.service?.url ?? "http://"}
          />
          {error && (
            <p className={styles.formError}>
              {text.t(
                error === "invalid_url"
                  ? "serverAddress.invalid"
                  : "serverAddress.failed",
              )}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={isPending}>
            {text.t("serverAddress.save")}
          </Button>
        </form>
      )}
      <p className={styles.muted}>
        {address.url
          ? text.t("serverAddress.hint")
          : text.t("serverAddress.missing")}
      </p>
    </section>
  );
}
