-- CreateTable
CREATE TABLE "_rho_system_owner" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "passwordHash" TEXT NOT NULL,
    "setupCompletedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_rho_system_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_rho_system_api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "_rho_system_sessions_tokenHash_key" ON "_rho_system_sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "_rho_system_api_tokens_tokenHash_key" ON "_rho_system_api_tokens"("tokenHash");
