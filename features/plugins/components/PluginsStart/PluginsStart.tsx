"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { PHONE_QUERY } from "@/lib/utils/useMediaQuery";

/**
 * The plugins' start page opens the first plugin — except on a phone, where
 * this address is the list of them (`SettingsBody`), and leaving it would
 * leave no way back to it.
 */
export function PluginsStart({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!window.matchMedia(PHONE_QUERY).matches) router.replace(href);
  }, [href, router]);
  return null;
}
