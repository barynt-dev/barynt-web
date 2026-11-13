import { ProjectPluginBadges } from "@/features/plugins/components/PluginBadges/ProjectPluginBadges";
import styles from "./layout.module.scss";

// Each view renders its own topbar — only it knows the count of filtered
// issues shown in the title. This layout holds the column together, and
// gives the views the badges plugins put on cards and rows (BARY-151).
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  return (
    <div className={styles.wrapper}>
      <ProjectPluginBadges workspaceId={workspace} projectSlug={projectSlug}>
        {children}
      </ProjectPluginBadges>
    </div>
  );
}
