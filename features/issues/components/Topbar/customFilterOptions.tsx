import { Icon } from "@iconify/react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { OptionVisual } from "@/features/custom-fields/components/OptionVisual/OptionVisual";
import { ME, NONE_VALUE } from "@/features/issues/filter";
import { CHECKBOX_NO, CHECKBOX_YES } from "@/features/issues/filter-custom";
import type { Translator } from "@/i18n/types";
import type { FieldDefinition } from "@/lib/custom-fields";
import { fullName } from "@/lib/utils/string";
import type { User } from "@/types";

export interface CustomFilterAnswer {
  value: string;
  label: string;
  /** A word on what the answer means — "whoever looks" for `@me`. */
  hint?: string;
  icon?: React.ReactNode;
}

/**
 * What a custom field's chip and the editor offer to tick (BARY-196): its
 * choices, the people — "me" first, as for the assignee — or a checkbox's
 * yes and no. "Not set" for every field that can be empty. Nothing for a
 * field without a list of answers.
 */
export function customFilterAnswers(
  field: FieldDefinition,
  members: User[],
  t: Translator,
): CustomFilterAnswer[] {
  const notSet = { value: NONE_VALUE, label: t("filters.notSet") };
  switch (field.type) {
    case "SELECT":
    case "MULTI_SELECT":
      return [
        notSet,
        ...field.options.map((o) => ({
          value: o.id,
          label: o.label,
          icon: <OptionVisual option={o} />,
        })),
      ];
    case "USER":
      return [
        {
          value: ME,
          label: t("filters.me"),
          hint: t("filters.meHint"),
          icon: <Icon icon="lucide:user-round" width={16} />,
        },
        notSet,
        ...members.map((u) => ({
          value: u.id,
          label: fullName(u),
          icon: <Avatar avatar={u} size={18} />,
        })),
      ];
    case "CHECKBOX":
      return [
        { value: CHECKBOX_YES, label: t("customFields.yes") },
        { value: CHECKBOX_NO, label: t("customFields.no") },
      ];
    default:
      return [];
  }
}
