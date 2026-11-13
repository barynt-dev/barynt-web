// Demo UI Kit (BARY-206): every component of the SDK's UI kit and every
// design token on one page — a plugin author's reference, and what the
// screenshots show. Nothing here is styled by hand: it's all the kit and
// `token()`.

import { Plugin, TOKEN_NAMES, type TokenName, token } from "@barynt/plugin-sdk";
import {
  accordion,
  avatar,
  badge,
  barChart,
  button,
  card,
  checkbox,
  confirm,
  dateField,
  dialog,
  divider,
  emptyState,
  grid,
  heading,
  icon,
  keyValue,
  kpi,
  labelChip,
  link,
  list,
  multiSelect,
  notice,
  progressBar,
  progressRing,
  radioGroup,
  row,
  segmentedControl,
  select,
  skeleton,
  spinner,
  stack,
  status,
  statusDot,
  swatchPicker,
  table,
  tabs,
  tag,
  text,
  textArea,
  textField,
  toast,
  toggle,
  tooltip,
  user,
} from "@barynt/plugin-sdk/ui";

export default class UiKit extends Plugin {
  onload() {
    this.registerPage({
      id: "gallery",
      render: (root) => {
        root.replaceChildren(this.page());
      },
    });
  }

  page(): HTMLElement {
    const line = status();
    const page = stack(
      heading({ text: "UI Kit", level: 1 }),
      text({
        text: "Every component of @barynt/plugin-sdk/ui and every design token — light or dark, like Barynt.",
        tone: "subtle",
      }),
      tabs({
        label: "Parts of the kit",
        tabs: [
          { id: "inputs", label: "Inputs", content: () => this.inputs(line) },
          { id: "display", label: "Display", content: () => this.display() },
          { id: "data", label: "Data", content: () => this.data() },
          { id: "tokens", label: "Tokens", content: () => this.tokens() },
        ],
      }),
    );
    page.style.padding = token("space.6");
    page.style.maxWidth = "64rem";
    return page;
  }

  inputs(line: ReturnType<typeof status>): HTMLElement {
    const name = textField({
      label: "Name",
      placeholder: "Weekly review",
      hint: "Enter saves.",
      onEnter: () => line.set("Saved.", "success"),
    });
    return grid({
      minWidth: "18rem",
      children: [
        card({
          title: "Text",
          children: [
            name.el,
            textArea({ label: "Description", rows: 3 }).el,
            dateField({ label: "Due", value: "2026-11-20" }).el,
          ],
        }),
        card({
          title: "Choices",
          children: [
            select({
              label: "Project",
              options: [
                { value: "web", label: "Web App" },
                { value: "mobile", label: "Mobile" },
              ],
            }).el,
            segmentedControl({
              label: "Range",
              options: [
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ],
              value: "30",
            }).el,
            multiSelect({
              label: "Days",
              options: ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => ({
                value: d.toLowerCase(),
                label: d,
              })),
              value: ["mon", "wed"],
            }).el,
          ],
        }),
        card({
          title: "On and off",
          children: [
            toggle({
              label: "Notify me",
              hint: "On every change.",
              checked: true,
            }).el,
            checkbox({ label: "Only my issues" }).el,
            radioGroup({
              label: "Sort",
              options: [
                { value: "due", label: "By due date" },
                { value: "prio", label: "By priority", hint: "Urgent first" },
              ],
              value: "due",
            }).el,
            swatchPicker({ label: "Colour", value: "teal" }).el,
          ],
        }),
        card({
          title: "Buttons",
          children: [
            row(
              button({
                label: "Save",
                variant: "primary",
                onClick: async () => {
                  await new Promise((r) => setTimeout(r, 800));
                  toast("Saved", { tone: "success" });
                },
              }),
              button({ label: "Cancel" }),
              button({ label: "More", variant: "ghost", icon: "ellipsis" }),
              button({
                label: "Delete",
                variant: "danger",
                icon: "trash",
                onClick: async () => {
                  const sure = await confirm({
                    title: "Delete the sync?",
                    text: "The issues stay; only the link to GitLab goes.",
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  line.set(
                    sure ? "Deleted." : "Kept.",
                    sure ? "warning" : "info",
                  );
                },
              }),
            ),
            row(
              tooltip(
                button({
                  label: "Refresh",
                  icon: "refresh-cw",
                  iconOnly: true,
                  size: "sm",
                }),
                "Load again",
              ),
              button({
                label: "Open dialog",
                size: "sm",
                onClick: () =>
                  dialog({
                    title: "Connect GitLab",
                    content: [
                      "Barynt keeps your token; the plugin never sees it.",
                    ],
                    actions: [button({ label: "Got it", variant: "primary" })],
                  }).open(),
              }),
            ),
            line.el,
          ],
        }),
      ],
    });
  }

  display(): HTMLElement {
    return grid({
      minWidth: "18rem",
      children: [
        card({
          title: "Text",
          description: "Headings, tones, a link out.",
          children: [
            heading({ text: "Heading 3", level: 3 }),
            text({ text: "Body text, as Barynt sets it." }),
            text({
              text: "Quieter text for what matters less.",
              tone: "subtle",
            }),
            text({ text: "const ok = true;", mono: true }),
            link({ text: "Plugin docs", href: "https://barynt.dev/docs" }),
            divider(),
            row(
              icon("git-pull-request"),
              icon("calendar"),
              icon("star"),
              icon("bell"),
              icon("sparkles"),
            ),
          ],
        }),
        card({
          title: "Small things",
          children: [
            row(
              badge({ text: "New", tone: "primary" }),
              badge({ text: "Merged", tone: "success" }),
              badge({ text: "Draft", tone: "warning" }),
              badge({ text: "Failed", tone: "danger" }),
              badge({ text: "3 open" }),
            ),
            row(
              labelChip({ name: "Bug", color: "red" }),
              labelChip({ name: "Frontend", color: "blue" }),
              tag({ text: "release-1.4", color: "purple", onRemove: () => {} }),
            ),
            row(
              statusDot({ label: "Todo", category: "unstarted" }),
              statusDot({ label: "In progress", category: "started" }),
              statusDot({ label: "Done", category: "completed" }),
            ),
            row(
              avatar({ name: "Ada Lovelace", color: "teal" }),
              user({ name: "Grace Hopper", color: "purple", meta: "Reviewer" }),
            ),
          ],
        }),
        card({
          title: "Telling",
          children: [
            notice({
              title: "Connected",
              text: "GitLab answers.",
              tone: "success",
            }),
            notice({ text: "The token expires in 3 days.", tone: "warning" }),
            notice({
              title: "No access",
              text: "GitLab didn't take the token.",
              tone: "danger",
            }),
            row(spinner({ label: "Loading merge requests…" })),
            skeleton({ lines: 3 }),
          ],
        }),
        card({
          title: "Numbers",
          children: [
            row(
              kpi({
                value: 12,
                label: "Open MRs",
                trend: { text: "+3 this week", good: false },
              }),
              progressRing({ value: 7, max: 10, label: "Reviewed" }),
            ),
            progressBar({ value: 6, max: 8, label: "Sprint" }),
            progressBar({ value: 2, max: 8, label: "Blocked", tone: "danger" }),
          ],
        }),
        card({
          title: "Empty",
          children: [
            emptyState({
              title: "No merge requests",
              text: "Open one in GitLab and it shows here.",
              icon: "git-pull-request",
              action: button({ label: "Open GitLab", size: "sm" }),
            }),
          ],
        }),
      ],
    });
  }

  data(): HTMLElement {
    return stack(
      table({
        caption: "Merge requests",
        columns: [
          { key: "title", label: "Title" },
          { key: "author", label: "Author" },
          { key: "state", label: "State" },
          { key: "changes", label: "Changes", align: "end" },
        ],
        rows: [
          {
            title: "WEB-7 Empty states",
            author: user({ name: "Ada Lovelace" }),
            state: badge({ text: "Open", tone: "primary" }),
            changes: 42,
          },
          {
            title: "WEB-9 Dark mode for charts",
            author: user({ name: "Grace Hopper", color: "purple" }),
            state: badge({ text: "Merged", tone: "success" }),
            changes: 118,
          },
          {
            title: "WEB-12 Faster board",
            author: user({ name: "Alan Turing", color: "amber" }),
            state: badge({ text: "Draft", tone: "warning" }),
            changes: 7,
          },
        ],
      }),
      grid({
        minWidth: "18rem",
        children: [
          card({
            title: "Details",
            children: [
              keyValue({
                items: [
                  { label: "Project", value: "acme/web" },
                  { label: "Branch", value: tag({ text: "main" }) },
                  {
                    label: "Pipeline",
                    value: badge({ text: "Passed", tone: "success" }),
                  },
                ],
              }),
            ],
          }),
          card({
            title: "Lists and bars",
            children: [
              list({
                items: [
                  { title: "WEB-7 Empty states", meta: "2 d" },
                  { title: "WEB-9 Dark mode for charts", meta: "5 d" },
                ],
              }),
              barChart({
                bars: [
                  { label: "Open", value: 12 },
                  { label: "Review", value: 5, color: "amber" },
                  { label: "Blocked", value: 2, color: "red" },
                ],
              }),
            ],
          }),
          card({
            title: "Folded",
            children: [
              accordion({
                items: [
                  {
                    title: "What does it read?",
                    content: "Issues of this project.",
                    open: true,
                  },
                  {
                    title: "What does it send?",
                    content: "Nothing — no network.",
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    );
  }

  tokens(): HTMLElement {
    const colours = TOKEN_NAMES.filter((n) => n.startsWith("color."));
    const sizes = TOKEN_NAMES.filter((n) => !n.startsWith("color."));
    const swatch = (name: TokenName) => {
      const chip = document.createElement("span");
      chip.style.cssText =
        "display:inline-block;width:1.25rem;height:1.25rem;border-radius:50%;flex:none";
      chip.style.background = token(name);
      chip.style.border = `1px solid ${token("color.border")}`;
      return chip;
    };
    return stack(
      notice({
        text: 'In CSS: var(--barynt-color-text). In code: token("color.text"). They follow light and dark on their own.',
      }),
      table({
        caption: "Colours",
        columns: [
          { key: "swatch", label: "" },
          { key: "name", label: "token()" },
          { key: "css", label: "CSS variable" },
        ],
        rows: colours.map((name) => ({
          swatch: swatch(name),
          name: text({ text: name, mono: true, inline: true }),
          css: text({
            text: `--barynt-${name.replaceAll(".", "-")}`,
            mono: true,
            inline: true,
            tone: "subtle",
          }),
        })),
      }),
      table({
        caption: "Type, space, shape",
        columns: [
          { key: "name", label: "token()" },
          { key: "css", label: "CSS variable" },
        ],
        rows: sizes.map((name) => ({
          name: text({ text: name, mono: true, inline: true }),
          css: text({
            text: `--barynt-${name.replaceAll(".", "-")}`,
            mono: true,
            inline: true,
            tone: "subtle",
          }),
        })),
      }),
    );
  }
}
