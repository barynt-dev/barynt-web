"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import {
  listPluginDeliveries,
  resumePluginService,
} from "@/features/plugins/actions";
import type { PluginServiceView } from "@/features/plugins/queries";
import { DeliveryLogModal } from "@/features/webhooks/components/WorkspaceWebhooks/DeliveryLogModal";
import { useModal } from "@/lib/context";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { usePluginText } from "../shared";
import styles from "./pluginService.module.scss";

/**
 * A plugin's own server in its settings (BARY-212): where Barynt sends its
 * events, which ones, how the last delivery went — and, once Barynt paused
 * it after a day of failures, the way to send again. The log is the
 * webhooks' (`DeliveryLogModal`).
 */
export function PluginService({ service }: { service: PluginServiceView }) {
  const text = usePluginText();
  const format = useFormatter();
  const router = useRouter();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const state = service.pausedAt
    ? "paused"
    : service.failingSince
      ? "failing"
      : service.last
        ? "ok"
        : "idle";

  const openLog = () =>
    openModal(
      ({ close }) => (
        <DeliveryLogModal
          load={() => listPluginDeliveries(service.activationId)}
          url={service.url}
          close={close}
          sheet={isPhone}
        />
      ),
      {
        ...(isPhone ? { placement: "bottom" as const } : {}),
        label: text.t("service.log"),
      },
    );

  const resume = () =>
    startTransition(async () => {
      const result = await resumePluginService(service.activationId);
      setError("error" in result);
      router.refresh();
    });

  return (
    <section className={styles.root} aria-labelledby="plugin-service">
      <div className={styles.head}>
        <h2 id="plugin-service">{text.t("service.title")}</h2>
        <span className={styles.state} data-state={state}>
          <span className={styles.dot} aria-hidden />
          {state === "paused"
            ? text.t("service.paused")
            : state === "failing"
              ? text.t("service.failing", {
                  date: format.dateTime(service.failingSince as Date, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : state === "ok"
                ? text.t("service.ok")
                : text.t("service.idle")}
        </span>
      </div>
      <p className={styles.hint}>{text.t("service.hint")}</p>

      <dl className={styles.facts}>
        <dt>{text.t("service.url")}</dt>
        <dd>
          <code>{service.url}</code>
        </dd>
        <dt>{text.t("service.events")}</dt>
        <dd className={styles.events}>
          {service.events.map((event) => (
            <Badge key={event} size="sm">
              {event}
            </Badge>
          ))}
        </dd>
        {service.last && (
          <>
            <dt>{text.t("service.last")}</dt>
            <dd>
              {service.last.status !== null
                ? `HTTP ${service.last.status}`
                : service.last.error}
              {" · "}
              {format.dateTime(service.last.at, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </>
        )}
      </dl>

      {state === "paused" && (
        <p className={styles.pausedNote} role="status">
          <Icon icon="lucide:circle-pause" width={15} aria-hidden />
          {text.t("service.pausedHint", {
            date: format.dateTime(service.pausedAt as Date, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
      {error && (
        <p className={styles.error}>{text.t("service.resumeFailed")}</p>
      )}

      <div className={styles.actions}>
        <Button
          variant="outline"
          icon={<Icon icon="lucide:history" width={15} />}
          onClick={openLog}
        >
          {text.t("service.log")}
        </Button>
        {state === "paused" && (
          <Button
            variant="primary"
            icon={<Icon icon="lucide:circle-play" width={15} />}
            disabled={isPending}
            onClick={resume}
          >
            {text.t("service.resume")}
          </Button>
        )}
      </div>
    </section>
  );
}
