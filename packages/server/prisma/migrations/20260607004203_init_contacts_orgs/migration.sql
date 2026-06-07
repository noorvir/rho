-- CreateTable
CREATE TABLE "contacts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "relationship" Relationship NOT NULL CHECK ("relationship" IN ('BookClub', 'Family', 'Friend', 'Gym', 'Neighbor', 'RunningGroup')),
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "birthday" DATETIME,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "lastContactedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "orgs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
CREATE UNIQUE INDEX "_ContactToOrg_AB_unique" ON "_ContactToOrg"("A", "B");

-- CreateIndex
CREATE INDEX "_ContactToOrg_B_index" ON "_ContactToOrg"("B");
