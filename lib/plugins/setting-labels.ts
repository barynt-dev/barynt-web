import { type CredentialLevel, validateManifest } from "./manifest";

/**
 * What the settings search finds on a running plugin's page at `level`: the
 * labels of its form's fields — unless it draws the whole page itself — and
 * of the credentials kept there. The page shows each label as it is, so a
 * hit can lead to it (`?setting=<label>`).
 */
export function settingLabelsOf(
  manifest: unknown,
  level: CredentialLevel,
  /** The person's language: the labels as the page shows them. */
  locale?: string,
): string[] {
  const parsed = validateManifest(manifest, locale);
  if (!parsed.ok) return [];
  const m = parsed.manifest;
  const ownPage =
    m.kind === "sandbox" &&
    !!m.contributes.settingsPage &&
    m.contributes.settingsPage !== "section";
  return [
    ...new Set([
      ...(ownPage || level === "user"
        ? []
        : (m.contributes.settings ?? []).map((f) => f.label)),
      ...(m.contributes.credentials ?? [])
        .filter((c) => c.level === level)
        .map((c) => c.label),
    ]),
  ];
}
