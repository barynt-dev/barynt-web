import { isCustomFilterField } from "@/features/issues/filter";
import type { FilterKey } from "./useTopbar";

/** Each filter's own outline color while it's set — the desktop chips, the
 *  chips in the tablet/phone popup and the conditions of the group row alike.
 *  Never primary or secondary: those mean "selected" and "action". */
export const FILTER_ACCENT: Record<
  Exclude<FilterKey, `cf:${string}`>,
  string
> = {
  status: "var(--teal)",
  type: "var(--tertiary)",
  priority: "var(--orange)",
  assignee: "var(--purple)",
  label: "var(--blue)",
  project: "var(--green)",
  storyPoints: "var(--lime)",
  dueDate: "var(--indigo)",
};

/** A filter's outline color — one shared by every custom field (BARY-196),
 *  `undefined` for a field without a chip. */
export function filterAccent(key: string): string | undefined {
  if (isCustomFilterField(key)) return "var(--amber)";
  return key in FILTER_ACCENT
    ? FILTER_ACCENT[key as keyof typeof FILTER_ACCENT]
    : undefined;
}
