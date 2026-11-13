// @barynt/plugin-sdk/ui — the UI kit (BARY-204, BARY-206): Barynt's
// components for a plugin's frame, so a plugin looks like Barynt without
// rebuilding it. Plain DOM, no framework: each function returns an element
// (an input returns a field with its element in `el`) to put wherever you
// like, next to your own. Drawn with Barynt's design tokens, light and dark
// like Barynt. Text always goes in as text, links only as `http(s)` or
// `mailto`, colours only as colours.

export {
  onThemeChange,
  type TokenName,
  theme,
  token,
  tokenValue,
  tokenVariable,
} from "./tokens";
export {
  type Child,
  type Field,
  type FieldOptions,
  PALETTE,
  type PaletteColor,
  type Tone,
} from "./ui/core";
export {
  accordion,
  type Column,
  keyValue,
  type Tab,
  table,
  tabs,
} from "./ui/data";
export {
  avatar,
  badge,
  barChart,
  card,
  copyField,
  diffStat,
  divider,
  emptyState,
  grid,
  heading,
  icon,
  kpi,
  type ListItem,
  labelChip,
  link,
  list,
  navList,
  notice,
  progressBar,
  progressRing,
  row,
  type Status,
  type StatusTone,
  type StepState,
  sectionHeader,
  skeleton,
  spinner,
  stack,
  status,
  statusDot,
  stepList,
  tag,
  text,
  toast,
  tooltip,
  user,
} from "./ui/display";
export { ICONS, type IconName } from "./ui/icons";
export {
  button,
  checkbox,
  dateField,
  multiSelect,
  type Option,
  radioGroup,
  segmentedControl,
  select,
  swatchPicker,
  textArea,
  textField,
  toggle,
} from "./ui/inputs";
export { confirm, type Dialog, dialog } from "./ui/overlay";
