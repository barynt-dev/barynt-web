"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import type { BlockData } from "@/lib/plugins/blocks";
import {
  BRIDGE_MAX_PENDING,
  BRIDGE_TIMEOUT_MS,
  type BridgeResponse,
  FRAME_READY_TIMEOUT_MS,
  type FrameContext,
  type HostMessage,
  type InitMessage,
  parseFrameMessage,
  THEME_TOKENS,
} from "@/lib/plugins/bridge";
import styles from "./pluginFrame.module.scss";

// The host side of a sandboxed plugin (BARY-144). It loads the plugin's
// frame (`/api/plugins/frame`, a sandbox with an opaque origin), hands it a
// private channel with its context and Barynt's design tokens, and forwards
// each request to the server (`/api/plugins/bridge`), where it's checked.
// A plugin that throws, doesn't answer or doesn't start shows as the
// plugin's error, with a way to load it again — never as a broken page.

/** Where a frame sits on a card of Barynt's — the card shows through. */
const ON_A_CARD = new Set<FrameContext["slot"]["kind"]>(["widget", "block"]);

/** Barynt's tokens as the page has them right now — light or dark — with
 *  its colour scheme, and a see-through background on a card. */
function readTheme(onCard: boolean): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return {
    ...Object.fromEntries(
      THEME_TOKENS.map((name) => [name, style.getPropertyValue(name).trim()]),
    ),
    // The same scheme as the page, or the browser backs the frame with an
    // opaque canvas and a transparent background shows white or black.
    "--color-scheme": style.colorScheme || "normal",
    ...(onCard && { "--frame-bg": "transparent" }),
  };
}

type FrameState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function PluginFrame({
  pluginId,
  name,
  context,
  headless,
  onBlockData,
}: {
  pluginId: string;
  /** The plugin's name — the frame's title, and in its error. */
  name: string;
  context: FrameContext;
  /** Runs out of sight — a building block whose data Barynt draws
   *  (BARY-205). Its error still shows. */
  headless?: boolean;
  /** A building block's data, checked (`parseBlockData`). */
  onBlockData?: (data: BlockData) => void;
}) {
  const t = useTranslations("plugins");
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<FrameState>({ status: "loading" });
  // A new frame on "Load again".
  const [attempt, setAttempt] = useState(0);
  const { workspaceId, projectId, slot } = context;
  const onCard = ON_A_CARD.has(slot.kind);

  const src = `/api/plugins/frame?${new URLSearchParams({
    plugin: pluginId,
    workspace: workspaceId,
    ...(projectId ? { project: projectId } : {}),
    slot: slot.kind,
    id: slot.id,
  })}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: one channel per loaded frame; `attempt` makes a new one
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let channel: MessageChannel | null = null;
    let open = 0;
    let readyTimer = 0;
    const controllers = new Set<AbortController>();

    const post = (message: HostMessage) => channel?.port1.postMessage(message);

    const forward = async (id: number, method: string, params: unknown) => {
      if (open >= BRIDGE_MAX_PENDING)
        return post({
          type: "result",
          id,
          ok: false,
          error: "too_many_requests",
        });
      open += 1;
      const controller = new AbortController();
      controllers.add(controller);
      const timer = window.setTimeout(
        () => controller.abort(),
        BRIDGE_TIMEOUT_MS,
      );
      try {
        const res = await fetch("/api/plugins/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plugin: pluginId,
            workspace: workspaceId,
            project: projectId,
            method,
            params,
          }),
          signal: controller.signal,
        });
        const body = (await res
          .json()
          .catch(() => null)) as BridgeResponse | null;
        if (body?.ok)
          post({ type: "result", id, ok: true, result: body.result });
        else
          post({
            type: "result",
            id,
            ok: false,
            error: body?.error ?? "forbidden",
          });
      } catch {
        post({ type: "result", id, ok: false, error: "timeout" });
      } finally {
        window.clearTimeout(timer);
        controllers.delete(controller);
        open -= 1;
      }
    };

    const start = () => {
      channel?.port1.close();
      channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        const message = parseFrameMessage(event.data);
        if (!message) return;
        if (message.type === "ready") {
          window.clearTimeout(readyTimer);
          setState({ status: "ready" });
        } else if (message.type === "error") {
          window.clearTimeout(readyTimer);
          setState({ status: "error", message: message.message });
        } else if (message.type === "blockData") {
          onBlockData?.(message.data);
        } else {
          void forward(message.id, message.method, message.params);
        }
      };
      const init: InitMessage = {
        type: "barynt:init",
        context,
        theme: readTheme(onCard),
      };
      // The frame's origin is opaque, so "*" — the port is what makes the
      // channel private, not the target origin.
      el.contentWindow?.postMessage(init, "*", [channel.port2]);
      readyTimer = window.setTimeout(
        () => setState({ status: "error", message: "timeout" }),
        FRAME_READY_TIMEOUT_MS,
      );
    };

    el.addEventListener("load", start);
    // The address only now, with the listener in place: a frame that loads
    // fast would otherwise be done before anyone hears it.
    el.src = src;

    // Light or dark switched: the frame follows.
    const sendTheme = () => post({ type: "theme", theme: readTheme(onCard) });
    const observer = new MutationObserver(sendTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", sendTheme);

    return () => {
      el.removeEventListener("load", start);
      observer.disconnect();
      scheme.removeEventListener("change", sendTheme);
      window.clearTimeout(readyTimer);
      for (const c of controllers) c.abort();
      channel?.port1.close();
    };
  }, [attempt, src]);

  return (
    <div
      className={styles.host}
      data-state={state.status}
      data-headless={headless || undefined}
    >
      <iframe
        key={attempt}
        ref={frame}
        className={styles.frame}
        title={name}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
      {state.status === "error" && (
        <div className={styles.error} role="alert">
          <Icon icon="lucide:puzzle" width={22} aria-hidden />
          <strong>
            {state.message === "timeout"
              ? t("frameTimeout", { name })
              : t("frameError", { name })}
          </strong>
          {state.message !== "timeout" && (
            <code className={styles.detail}>{state.message}</code>
          )}
          <Button
            variant="outline"
            icon={<Icon icon="lucide:rotate-cw" width={15} />}
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t("frameReload")}
          </Button>
        </div>
      )}
    </div>
  );
}
