-- Ein Workspace gibt ein Plugin für seine Projekte frei (BARY-143).
-- CreateTable
CREATE TABLE "PluginGrant" (
    "pluginId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginGrant_pkey" PRIMARY KEY ("pluginId","workspaceId")
);

-- CreateIndex
CREATE INDEX "PluginGrant_workspaceId_idx" ON "PluginGrant"("workspaceId");

-- AddForeignKey
ALTER TABLE "PluginGrant" ADD CONSTRAINT "PluginGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginGrant" ADD CONSTRAINT "PluginGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

