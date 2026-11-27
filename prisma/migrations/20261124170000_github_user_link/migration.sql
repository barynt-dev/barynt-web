-- A person's GitHub account, linked through the instance's GitHub App (BARY-238).
CREATE TABLE "GitHubUserLink" (
    "userId" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "avatar" TEXT,
    "accessCipher" TEXT NOT NULL,
    "refreshCipher" TEXT,
    "expiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubUserLink_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "GitHubUserLink" ADD CONSTRAINT "GitHubUserLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
