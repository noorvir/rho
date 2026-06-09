-- CreateTable
CREATE TABLE "contacts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "birthday" DATETIME,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "last_contacted_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "orgs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_rho_system_owner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "password_hash" TEXT NOT NULL,
    "setup_completed_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_rho_system_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "access_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT,
    "access_expires_at" DATETIME NOT NULL,
    "refresh_expires_at" DATETIME,
    "revoked_at" DATETIME,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_rho_system_api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "revoked_at" DATETIME,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_ContactToOrg" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ContactToOrg_A_fkey" FOREIGN KEY ("A") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ContactToOrg_B_fkey" FOREIGN KEY ("B") REFERENCES "orgs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orgs_name_key" ON "orgs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_rho_system_sessions_access_token_hash_key" ON "_rho_system_sessions"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "_rho_system_sessions_refresh_token_hash_key" ON "_rho_system_sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "_rho_system_api_tokens_token_hash_key" ON "_rho_system_api_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "_ContactToOrg_AB_unique" ON "_ContactToOrg"("A", "B");

-- CreateIndex
CREATE INDEX "_ContactToOrg_B_index" ON "_ContactToOrg"("B");

