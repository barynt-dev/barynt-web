"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { useRouter } from "@/i18n/navigation";
import { useOptionalModal } from "@/lib/context/ModalContext/modalContext";
import { pluginPath } from "@/lib/nav";
import type { BadgeIssue } from "@/lib/plugins/badges";
import type { BlockData } from "@/lib/plugins/blocks";
import {
  BRIDGE_MAX_PENDING,
  BRIDGE_TIMEOUT_MS,
  type BridgeResponse,
  FRAME_READY_TIMEOUT_MS,
  type FrameContext,
  type FrameMenuItem,
  type FrameModal,
  type HostMessage,
  type InitMessage,
  parseFrameMessage,
  THEME_TOKENS,
} from "@/lib/plugins/bridge";
import { actionIcon } from "@/lib/plugins/plugin-actions";
import { useOptionalUI } from "@/lib/ui-store";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { PluginDialog } from "../shared";
import styles from "./pluginFrame.module.scss";
import { useDevReload } from "./useDevReload";

// The host side of a sandboxed plugin (BARY-144). It loads the plugin's
// frame (`/api/plugins/frame`, a sandbox with an opaque origin), hands it a
// private channel with its context and Barynt's design tokens, and forwards
// each request to the server (`/api/plugins/bridge`), where it's checked.
// A plugin that throws, doesn't answer or doesn't start shows as the
// plugin's error, with a way to load it again — never as a broken page.

/** Where a frame sits on a card or in a view of Barynt's — what's behind
 *  it shows through. */
const ON_A_CARD = new Set<FrameContext["slot"]["kind"]>([
  "widget",
  "block",
  "issuePanel",
]);

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

/** Saves a file a frame hands over — as the page, which may download. */
function saveFile(file: {
  name: string;
  mime: string;
  data: string;
  base64: boolean;
}) {
  const blob = file.base64
    ? new Blob([Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))], {
        type: file.mime,
      })
    : new Blob([file.data], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** How wide a plugin's window is, by its `size` (px). */
const MODAL_WIDTH: Record<FrameModal["size"], number> = {
  sm: 420,
  md: 560,
  lg: 760,
  xl: 1120,
};

/** How tall a panel is while its frame starts — its skeleton's room (px). */
const SKELETON_HEIGHT = 96;

export function PluginFrame({
  pluginId,
  name,
  context,
  headless,
  onBlockData,
  autoHeight,
  badgeRequest,
  onBadges,
  actionRequest,
  onActionDone,
  onRunAction,
  saveRequest,
  onUnsaved,
  onSaveDone,
  onError,
  onCloseModal,
  onModalBack,
  backRequest,
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
  /** As tall as its content, within these bounds (px) — a panel in an
   *  issue (BARY-150). Without, it fills its slot. */
  autoHeight?: { min: number; max: number };
  /** A batch of issues for its badges, sent once it's ready and whenever
   *  this changes (BARY-151). */
  badgeRequest?: { seq: number; issues: BadgeIssue[] } | null;
  /** Its answer, unchecked — the caller knows what it asked. */
  onBadges?: (seq: number, badges: unknown) => void;
  /** One of its actions to run, once it's ready (BARY-152). */
  actionRequest?: {
    seq: number;
    actionId: string;
    issueId: string | null;
    /** What was picked, when the action asked first. */
    choice?: string;
    /** What was filled in, when the action asked for a form. */
    values?: Record<string, string>;
  } | null;
  /** How it went: its answer (unchecked), or the error. */
  onActionDone?: (seq: number, ok: boolean, result: unknown) => void;
  /** An issue panel starts one of its plugin's actions (BARY-238). */
  onRunAction?: (actionId: string, choice?: string) => void;
  /** Save its settings page — Barynt's Save button was pressed. */
  saveRequest?: { seq: number } | null;
  /** Its settings page has changes to save, or none any more — the first
   *  call says it saves with Barynt's button at all. */
  onUnsaved?: (unsaved: boolean) => void;
  /** How saving went: done, or the error it threw. */
  onSaveDone?: (seq: number, ok: boolean, error?: string) => void;
  /** It threw, or didn't start in time — besides showing so. */
  onError?: (message: string) => void;
  /** In a window it opened (`openModal`): closes that window. */
  onCloseModal?: () => void;
  /** In a window: whether it wants a back arrow in the window's head. */
  onModalBack?: (on: boolean) => void;
  /** That arrow was pressed — tell the frame (a new `seq` each time). */
  backRequest?: number;
}) {
  const t = useTranslations("plugins");
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<FrameState>({ status: "loading" });
  const [height, setHeight] = useState<number | null>(null);
  // Its toasts are Barynt's own; its menus Barynt draws over it — a frame
  // is too small for one (BARY-238).
  // Outside the app's provider (a test, say) a frame just has no toasts.
  const ui = useOptionalUI();
  // Its settings page, when it asks for it (BARY-238).
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const toastRef = useRef(ui?.toast);
  toastRef.current = ui?.toast;
  // A window of Barynt's with another frame of it (BARY-238): for the
  // same place, told which view to show — a dialog, on a phone a sheet.
  const modals = useOptionalModal();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const openFrameModal = (m: FrameModal) => {
    if (!modals) return;
    const { focus: _, ...place } = context;
    modals.openModal(
      ({ close }) => (
        <FrameWindow
          title={m.title}
          sheet={isPhone}
          close={close}
          width={MODAL_WIDTH[m.size]}
          frame={(back) => (
            <PluginFrame
              pluginId={pluginId}
              name={name}
              context={{
                ...place,
                modal: {
                  view: m.view,
                  ...(m.data !== undefined && { data: m.data }),
                },
              }}
              autoHeight={{ min: 120, max: Number.POSITIVE_INFINITY }}
              onRunAction={onRunAction}
              onCloseModal={close}
              onModalBack={back.set}
              backRequest={back.request}
            />
          )}
        />
      ),
      { ...(isPhone && { placement: "bottom" as const }), label: m.title },
    );
  };
  const openFrameModalRef = useRef(openFrameModal);
  openFrameModalRef.current = openFrameModal;
  const [menu, setMenu] = useState<{
    id: number;
    items: FrameMenuItem[];
    anchor: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const menuAnchor = useRef<HTMLDivElement>(null);
  const closeMenu = (itemId: string | null) => {
    if (!menu) return;
    send.current?.({ type: "menu:pick", id: menu.id, itemId });
    setMenu(null);
  };
  // The channel's handler is made once: it closes through the latest.
  const closeMenuRef = useRef(closeMenu);
  closeMenuRef.current = closeMenu;
  // The latest callbacks: the channel lives as long as the frame, the
  // callbacks change with every render of the caller.
  const callbacks = useRef({
    onBlockData,
    onBadges,
    onActionDone,
    onRunAction,
    onUnsaved,
    onSaveDone,
    onError,
    onCloseModal,
    onModalBack,
  });
  callbacks.current = {
    onBlockData,
    onBadges,
    onActionDone,
    onRunAction,
    onUnsaved,
    onSaveDone,
    onError,
    onCloseModal,
    onModalBack,
  };
  // Sends to the frame's channel — set while one is open.
  const send = useRef<((message: HostMessage) => void) | null>(null);
  // A new frame on "Load again" — and, in development, whenever the
  // plugin's files change (BARY-221).
  const [attempt, setAttempt] = useState(0);
  useDevReload(pluginId, () => setAttempt((n) => n + 1));
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
    send.current = post;

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
          callbacks.current.onError?.(message.message);
        } else if (message.type === "blockData") {
          callbacks.current.onBlockData?.(message.data);
        } else if (message.type === "resize") {
          setHeight(message.height);
        } else if (message.type === "actionDone") {
          callbacks.current.onActionDone?.(
            message.seq,
            message.ok,
            message.result,
          );
        } else if (message.type === "badges") {
          callbacks.current.onBadges?.(message.seq, message.badges);
        } else if (message.type === "unsaved") {
          callbacks.current.onUnsaved?.(message.unsaved);
        } else if (message.type === "saveDone") {
          callbacks.current.onSaveDone?.(
            message.seq,
            message.ok,
            message.error,
          );
        } else if (message.type === "toast") {
          toastRef.current?.(message.text);
        } else if (message.type === "menu:close") {
          closeMenuRef.current(null);
        } else if (message.type === "menu") {
          setMenu({
            id: message.id,
            items: message.items,
            anchor: message.anchor,
          });
        } else if (message.type === "openSettings") {
          // Its page in the plugins' area — the project's by its id, which
          // the page turns into its address.
          const query = new URLSearchParams({ level: message.level });
          if (message.level === "project" && projectId)
            query.set("project", projectId);
          routerRef.current.push(
            `${pluginPath(workspaceId, pluginId)}?${query}`,
          );
        } else if (message.type === "openModal") {
          const { type: _, ...m } = message;
          openFrameModalRef.current(m);
        } else if (message.type === "download") {
          saveFile(message);
        } else if (message.type === "modalBack") {
          callbacks.current.onModalBack?.(message.on);
        } else if (message.type === "closeModal") {
          callbacks.current.onCloseModal?.();
        } else if (message.type === "runAction") {
          callbacks.current.onRunAction?.(message.actionId, message.choice);
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
      send.current = null;
    };
  }, [attempt, src]);

  // An action to run, once it listens (BARY-152).
  useEffect(() => {
    if (state.status === "ready" && actionRequest)
      send.current?.({ type: "action:run", ...actionRequest });
  }, [state.status, actionRequest]);

  // Save its settings page, once it listens.
  // The back arrow in its window's head was pressed (BARY-238).
  useEffect(() => {
    if (backRequest) send.current?.({ type: "modal:back" });
  }, [backRequest]);

  useEffect(() => {
    if (state.status === "ready" && saveRequest)
      send.current?.({ type: "settings:save", ...saveRequest });
  }, [state.status, saveRequest]);

  // The issues to put badges on, once it listens — and again when they
  // change (BARY-151).
  useEffect(() => {
    if (state.status === "ready" && badgeRequest)
      send.current?.({ type: "badges:request", ...badgeRequest });
  }, [state.status, badgeRequest]);

  return (
    <div
      className={styles.host}
      data-state={state.status}
      data-headless={headless || undefined}
      data-auto-height={autoHeight ? "" : undefined}
      style={
        autoHeight
          ? {
              height: Math.min(
                autoHeight.max,
                // Still starting: room for its skeleton.
                state.status === "loading"
                  ? Math.max(autoHeight.min, SKELETON_HEIGHT)
                  : Math.max(autoHeight.min, height ?? autoHeight.min),
              ),
            }
          : undefined
      }
    >
      <iframe
        key={attempt}
        ref={frame}
        className={styles.frame}
        title={name}
        // Links and buttons may open a tab (BARY-230) — as its own page,
        // not sandboxed, and without a way back to Barynt (`noopener`).
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        // Writing only — a copy button (BARY-209); reading stays out.
        allow="clipboard-write"
        referrerPolicy="no-referrer"
      />
      {/* A panel still starting: a skeleton where it'll be. */}
      {autoHeight && state.status === "loading" && (
        <div className={styles.skeleton} aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
      {/* Its menu: anchored where its button is in the frame. */}
      {menu && (
        <>
          <div
            ref={menuAnchor}
            className={styles.menuAnchor}
            style={{
              left: menu.anchor.x,
              top: menu.anchor.y,
              width: menu.anchor.width,
              height: menu.anchor.height,
            }}
            aria-hidden
          />
          <Popover
            anchorRef={menuAnchor}
            open
            align="end"
            width={220}
            onClose={() => closeMenu(null)}
          >
            <SelectMenu
              items={menu.items.map((item) => {
                const icon = actionIcon(item.icon);
                return {
                  value: item.id,
                  label: item.label,
                  ...(icon && {
                    icon: (
                      <Icon
                        icon={icon}
                        width={15}
                        className={item.danger ? styles.danger : undefined}
                      />
                    ),
                  }),
                };
              })}
              value={null}
              onPick={(value) =>
                closeMenu(value === null ? null : String(value))
              }
              onClose={() => closeMenu(null)}
            />
          </Popover>
        </>
      )}
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

/** A plugin's window: Barynt's dialog (a sheet on a phone) with its frame
 *  inside — and a back arrow in its head while the frame wants one. */
function FrameWindow({
  title,
  sheet,
  close,
  width,
  frame,
}: {
  title: string;
  sheet: boolean;
  close: () => void;
  width: number;
  frame: (back: {
    set: (on: boolean) => void;
    request: number;
  }) => React.ReactNode;
}) {
  const [back, setBack] = useState(false);
  const [request, setRequest] = useState(0);
  return (
    <PluginDialog
      title={title}
      sheet={sheet}
      close={close}
      width={width}
      {...(back && { onBack: () => setRequest((n) => n + 1) })}
    >
      {frame({ set: setBack, request })}
    </PluginDialog>
  );
}
