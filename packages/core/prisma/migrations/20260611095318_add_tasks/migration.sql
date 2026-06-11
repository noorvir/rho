-- CreateTable
CREATE TABLE "_rho_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_key" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "summary" TEXT,
    "session_file" TEXT,
    "heartbeat_at" DATETIME,
    "notified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
