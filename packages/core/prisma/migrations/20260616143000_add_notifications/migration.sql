-- CreateTable
CREATE TABLE "rho_sys_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "def_key" TEXT NOT NULL,
    "extension_id" TEXT NOT NULL,
    "def_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "read_at" DATETIME,
    "dismissed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "rho_sys_notifications_def_key_idempotency_key_key" ON "rho_sys_notifications"("def_key", "idempotency_key");

-- CreateIndex
CREATE INDEX "rho_sys_notifications_dismissed_at_created_at_index" ON "rho_sys_notifications"("dismissed_at", "created_at");

-- CreateIndex
CREATE INDEX "rho_sys_notifications_extension_id_def_id_index" ON "rho_sys_notifications"("extension_id", "def_id");
