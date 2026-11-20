-- AlterTable
ALTER TABLE "PluginActivation" ADD COLUMN     "serviceUrl" TEXT;

-- CreateTable
CREATE TABLE "PluginServiceAddress" (
    "pluginId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginServiceAddress_pkey" PRIMARY KEY ("pluginId")
);

-- AddForeignKey
ALTER TABLE "PluginServiceAddress" ADD CONSTRAINT "PluginServiceAddress_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

