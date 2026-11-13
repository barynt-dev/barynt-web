"use client";

import { createContext, useContext } from "react";
import type { PluginBlockEntry } from "@/features/dashboard/types";

// The building blocks the plugins switched on here bring (BARY-205), for
// the custom widget's builder: what "Add block" offers next to Barynt's
// own, and each one's name and settings. The dashboard provides it — again
// around its modals, which render outside it.

const PluginBlocks = createContext<PluginBlockEntry[]>([]);

export function PluginBlocksProvider({
  blocks,
  children,
}: {
  blocks: PluginBlockEntry[];
  children: React.ReactNode;
}) {
  return (
    <PluginBlocks.Provider value={blocks}>{children}</PluginBlocks.Provider>
  );
}

export function usePluginBlocks(): PluginBlockEntry[] {
  return useContext(PluginBlocks);
}
