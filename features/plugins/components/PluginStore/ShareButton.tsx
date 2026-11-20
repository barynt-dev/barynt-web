"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { usePluginText } from "../shared";

/**
 * Shares a plugin's page (BARY-237) as an icon button: through the
 * browser's own share sheet where it has one (a phone, Safari), else the
 * address goes to the clipboard and the icon turns into a check for a
 * moment. The address is the page's own without its tab, so the person who
 * opens it lands on the overview.
 */
export function ShareButton({ name }: { name: string }) {
  const text = usePluginText();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.hash = "";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url: url.toString() });
        return;
      } catch (error) {
        // Closing the sheet isn't a failure; anything else falls back to
        // copying.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      // No clipboard without permission or over an insecure connection.
    }
  };

  const label = copied ? text.t("linkCopied") : text.t("share");
  return (
    <Button
      variant="text"
      icon={
        <Icon icon={copied ? "lucide:check" : "lucide:share-2"} width={16} />
      }
      aria-label={label}
      title={label}
      onClick={share}
    />
  );
}
