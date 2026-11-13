-- Credentials a plugin needs for its hosts, kept sealed and added to its
-- requests through the host proxy by Barynt itself (BARY-147).
-- CreateTable
CREATE TABLE "PluginCredential" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueCipher" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PluginCredential_scopeKey_idx" ON "PluginCredential"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "PluginCredential_pluginId_scopeKey_key_key" ON "PluginCredential"("pluginId", "scopeKey", "key");

-- AddForeignKey
ALTER TABLE "PluginCredential" ADD CONSTRAINT "PluginCredential_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

