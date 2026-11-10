// The tabs of a plugin in the store — in their own file because the page (a
// Server Component) reads them too, and a list from a `"use client"` module
// only reaches the server as a reference.

export const STORE_TABS = [
  "overview",
  "capabilities",
  "versions",
  "places",
] as const;
export type StoreTab = (typeof STORE_TABS)[number];
