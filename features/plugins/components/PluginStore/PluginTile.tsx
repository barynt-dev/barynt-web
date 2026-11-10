import styles from "./pluginStore.module.scss";

/** How many tile colors there are (`[data-hue]` in the styles). */
const HUES = 8;

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
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={styles.tile}
      data-hue={hash % HUES}
      data-size={size}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
