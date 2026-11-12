import styles from "./pluginStore.module.scss";

/** How many tile colors there are (`[data-hue]` in the styles). */
const HUES = 8;

/** The color a plugin's id picks (`[data-hue]`), the same everywhere. */
export function tileHue(id: string): number {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return hash % HUES;
}

/** A plugin's mark: its first letter on a color picked from its id, so the
 *  same plugin always looks the same. */
export function PluginTile({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={styles.tile}
      data-hue={tileHue(id)}
      data-size={size}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
