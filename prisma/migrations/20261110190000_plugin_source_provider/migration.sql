-- Plugin sources on any Git host (BARY-198). Existing sources point at
-- their plugins.json directly, which is what "https" means.
ALTER TABLE "PluginSource" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'https';
ALTER TABLE "PluginSource" ADD COLUMN "ref" TEXT;
