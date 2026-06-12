-- Rename rho system tables to the rho_sys_* convention. Pure renames so
-- existing owner, session, token, and task data is preserved.
ALTER TABLE "_rho_tasks" RENAME TO "rho_sys_tasks";
ALTER TABLE "_rho_system_owner" RENAME TO "rho_sys_owner";
ALTER TABLE "_rho_system_sessions" RENAME TO "rho_sys_sessions";
ALTER TABLE "_rho_system_api_tokens" RENAME TO "rho_sys_api_tokens";

-- Recreate unique indexes under names matching the new table names.
DROP INDEX "_rho_system_sessions_access_token_hash_key";
CREATE UNIQUE INDEX "rho_sys_sessions_access_token_hash_key" ON "rho_sys_sessions"("access_token_hash");
DROP INDEX "_rho_system_sessions_refresh_token_hash_key";
CREATE UNIQUE INDEX "rho_sys_sessions_refresh_token_hash_key" ON "rho_sys_sessions"("refresh_token_hash");
DROP INDEX "_rho_system_api_tokens_token_hash_key";
CREATE UNIQUE INDEX "rho_sys_api_tokens_token_hash_key" ON "rho_sys_api_tokens"("token_hash");
