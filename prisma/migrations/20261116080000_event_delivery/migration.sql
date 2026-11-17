-- CreateEnum
CREATE TYPE "EventDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "autoDisabledAt" TIMESTAMP(3),
ADD COLUMN     "failingSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventDelivery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "EventDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "lastResponse" TEXT,
    "lastDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventDelivery_status_nextAttemptAt_idx" ON "EventDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EventDelivery_webhookId_createdAt_idx" ON "EventDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "EventDelivery_createdAt_idx" ON "EventDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

