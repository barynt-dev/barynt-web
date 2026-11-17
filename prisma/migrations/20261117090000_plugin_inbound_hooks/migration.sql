-- CreateTable
CREATE TABLE "PluginInboundHook" (
    "id" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReceivedAt" TIMESTAMP(3),
    "lastEvent" TEXT,
    "lastStatus" INTEGER,
    "lastError" TEXT,

    CONSTRAINT "PluginInboundHook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PluginInboundHook_token_key" ON "PluginInboundHook"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PluginInboundHook_activationId_hookId_key" ON "PluginInboundHook"("activationId", "hookId");

-- AddForeignKey
ALTER TABLE "PluginInboundHook" ADD CONSTRAINT "PluginInboundHook_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PluginActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

