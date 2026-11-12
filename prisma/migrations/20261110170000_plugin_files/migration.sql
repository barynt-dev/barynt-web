-- Die Dateien einer installierten Plugin-Version (BARY-142).
-- CreateTable
CREATE TABLE "PluginFile" (
    "pluginRowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "PluginFile_pkey" PRIMARY KEY ("pluginRowId","name")
);

-- AddForeignKey
ALTER TABLE "PluginFile" ADD CONSTRAINT "PluginFile_pluginRowId_fkey" FOREIGN KEY ("pluginRowId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
