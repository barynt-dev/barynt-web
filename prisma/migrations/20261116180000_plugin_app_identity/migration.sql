-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('PERSON', 'APP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kind" "UserKind" NOT NULL DEFAULT 'PERSON';

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "activationId" TEXT;

-- AlterTable
ALTER TABLE "PluginActivation" ADD COLUMN     "botUserId" TEXT,
ADD COLUMN     "serviceToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PluginActivation_botUserId_key" ON "PluginActivation"("botUserId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PluginActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginActivation" ADD CONSTRAINT "PluginActivation_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

