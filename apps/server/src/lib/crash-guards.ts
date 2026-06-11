/**
 * Keeps the rho server alive when stray exceptions escape async boundaries,
 * for example from agent extensions running inside embedded sessions. The
 * server is a long-lived personal runtime: log and continue, never die from
 * one bad extension or background turn.
 */
export function installCrashGuards(): void {
	process.on("uncaughtException", (error) => {
		console.error("rho server uncaught exception:", error);
	});
	process.on("unhandledRejection", (error) => {
		console.error("rho server unhandled rejection:", error);
	});
}
