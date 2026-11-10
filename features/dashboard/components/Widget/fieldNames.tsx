"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext } from "react";
import {
  type GroupField,
  isCustomWidgetField,
  type Measure,
} from "@/features/dashboard/widgets";
import type { FieldDefinition } from "@/lib/custom-fields";

/** What a widget needs to know of a custom field to name it (BARY-197). */
export type WidgetFieldInfo = Pick<
  FieldDefinition,
  "id" | "name" | "type" | "numberUnit"
>;

const WidgetFieldsContext = createContext<WidgetFieldInfo[]>([]);

/**
 * The custom fields a dashboard's widgets may group by or add up. Around
 * the dashboard and around each of its modals — those render outside its
 * tree.
 */
export function WidgetFieldsProvider({
  fields = [],
  children,
}: {
  fields?: WidgetFieldInfo[];
  children: React.ReactNode;
}) {
  return (
    <WidgetFieldsContext.Provider value={fields}>
      {children}
    </WidgetFieldsContext.Provider>
  );
}

/** The fields themselves — the settings offer them. */
export function useWidgetFields(): WidgetFieldInfo[] {
  return useContext(WidgetFieldsContext);
}

/**
 * Names for groupings and measures, a custom field's by its own name — "by
 * Customer", "Deal value". A field that's gone says so.
 */
export function useWidgetFieldNames() {
  const t = useTranslations("widgets");
  const fields = useContext(WidgetFieldsContext);
  const custom = (ref: `cf:${string}`) =>
    fields.find((f) => `cf:${f.id}` === ref);

  return {
    group: (field: GroupField): string =>
      isCustomWidgetField(field)
        ? (custom(field)?.name ?? t("removedField"))
        : t(`group_${field}`),
    measure: (measure: Measure): string =>
      isCustomWidgetField(measure)
        ? (custom(measure)?.name ?? t("removedField"))
        : t(`measure_${measure}`),
    /** "SP", "h", a number field's own unit — `null` for a plain count. */
    unit: (measure: Measure | undefined): string | null => {
      if (!measure || measure === "count") return null;
      if (isCustomWidgetField(measure))
        return custom(measure)?.numberUnit ?? null;
      return t(`unit_${measure}`);
    },
  };
}
