// A local plugin directory for development (BARY-143). With `PLUGIN_DEV_BASE`
// set to a local address (e.g. `http://localhost:4555`, what
// `bun run plugins:demo` serves), the directory client also reads sources and
// releases from there — plain http, no GitHub. Never in production, never
// for anything but localhost: everywhere else the guarded fetch applies as
// always (`lib/public-fetch.ts`).

/** The local directory's base, or `null` when there is none. */
export function pluginDevBase(): URL | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.PLUGIN_DEV_BASE;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return local && (url.protocol === "http:" || url.protocol === "https:")
      ? url
      : null;
  } catch {
    return null;
  }
}

/** Whether `url` is on the local directory's origin. */
export function isDevUrl(url: URL): boolean {
  const base = pluginDevBase();
  return !!base && url.origin === base.origin;
}
