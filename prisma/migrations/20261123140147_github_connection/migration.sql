-- CreateTable
CREATE TABLE "GitHubApp" (
    "id" TEXT NOT NULL DEFAULT 'github',
    "appId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "owner" TEXT,
    "clientId" TEXT NOT NULL,
    "clientSecretCipher" TEXT NOT NULL,
    "privateKeyCipher" TEXT NOT NULL,
    "webhookSecretCipher" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginConnection" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountAvatar" TEXT,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PluginConnection_installationId_idx" ON "PluginConnection"("installationId");

-- CreateIndex
CREATE INDEX "PluginConnection_workspaceId_idx" ON "PluginConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PluginConnection_pluginId_scopeKey_installationId_key" ON "PluginConnection"("pluginId", "scopeKey", "installationId");

-- AddForeignKey
ALTER TABLE "PluginConnection" ADD CONSTRAINT "PluginConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
