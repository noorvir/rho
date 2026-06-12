-- CreateTable
CREATE TABLE "habits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "habit_completions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "habit_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "habit_completions_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "habit_completions_habit_id_date_key" ON "habit_completions"("habit_id", "date");
