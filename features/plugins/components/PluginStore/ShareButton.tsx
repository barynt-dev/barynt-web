"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { useModal } from "@/lib/context";
import { PHONE_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { usePluginText } from "../shared";
import { ShareDialog } from "./ShareDialog";

/**
 * Opens the sharing dialog of a plugin's page (BARY-237), as an icon button.
 * What's shared is the plugin's own address when it has one — a homepage
 * or its repository — because Barynt's page for it only opens signed in;
 * else this page's, without its tab.
 */
export function ShareButton({
  name,
  description,
  publicUrl,
}: {
  name: string;
  description: string;
  /** The plugin's own address, if it has one. */
  publicUrl: string | null;
}) {
  const text = usePluginText();
  const { openModal } = useModal();
  const isPhone = useMediaQuery(PHONE_QUERY);

  const open = () => {
    const page = new URL(window.location.href);
    page.searchParams.delete("tab");
    page.hash = "";
    openModal(
      ({ close }) => (
        <ShareDialog
          name={name}
          description={description}
          url={publicUrl ?? page.toString()}
          isPublic={publicUrl !== null}
          sheet={isPhone}
          close={close}
        />
      ),
      {
        ...(isPhone ? { placement: "bottom" as const } : {}),
        label: text.t("shareTitle", { name }),
      },
    );
  };

  return (
    <Button
      variant="text"
      icon={<Icon icon="lucide:share-2" width={16} />}
      aria-label={text.t("share")}
      title={text.t("share")}
      onClick={open}
    />
  );
}
