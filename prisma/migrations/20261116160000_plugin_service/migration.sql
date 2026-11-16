-- AlterTable
ALTER TABLE "EventDelivery" ADD COLUMN     "activationId" TEXT,
ALTER COLUMN "webhookId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PluginActivation" ADD COLUMN     "serviceFailingSince" TIMESTAMP(3),
ADD COLUMN     "servicePausedAt" TIMESTAMP(3),
ADD COLUMN     "serviceSecret" TEXT;

-- CreateIndex
CREATE INDEX "EventDelivery_activationId_createdAt_idx" ON "EventDelivery"("activationId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PluginActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one target: a webhook or a plugin's service.
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_one_target" CHECK (("webhookId" IS NULL) <> ("activationId" IS NULL));
