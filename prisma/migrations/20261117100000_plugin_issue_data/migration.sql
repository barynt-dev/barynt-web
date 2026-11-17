-- CreateTable
CREATE TABLE "PluginIssueData" (
    "id" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginIssueData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PluginIssueData_issueId_idx" ON "PluginIssueData"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "PluginIssueData_activationId_issueId_key_key" ON "PluginIssueData"("activationId", "issueId", "key");

-- AddForeignKey
ALTER TABLE "PluginIssueData" ADD CONSTRAINT "PluginIssueData_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PluginActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginIssueData" ADD CONSTRAINT "PluginIssueData_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

