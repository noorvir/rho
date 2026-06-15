-- CreateTable
CREATE TABLE "rho_sys_crons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "schedule_kind" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'not_run',
    "next_run_at" DATETIME NOT NULL,
    "last_run_at" DATETIME,
    "last_error" TEXT,
    "active_run_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "instructions" TEXT,
    "conversation_key" TEXT,
    "channel_id" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "extension_id" TEXT
);

-- CreateIndex
CREATE INDEX "rho_sys_crons_next_run_at_index" ON "rho_sys_crons"("next_run_at");

-- CreateIndex
CREATE INDEX "rho_sys_crons_extension_id_index" ON "rho_sys_crons"("extension_id");
