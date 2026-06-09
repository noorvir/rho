import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../auth.tsx";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
	const auth = useAuth();
	const navigate = useNavigate();
	const [error, setError] = useState<string>();
	const [loggingOut, setLoggingOut] = useState(false);

	async function logout() {
		setLoggingOut(true);
		setError(undefined);
		try {
			await auth.logout();
			await navigate({ to: "/" });
		} catch (error) {
			setError(error instanceof Error ? error.message : "Failed to log out");
		} finally {
			setLoggingOut(false);
		}
	}

	return (
		<section className="w-full border border-border bg-card shadow-sm">
			<header className="border-b border-border px-4 py-3">
				<p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Settings</p>
				<h2 className="mt-1 font-semibold">Workspace access</h2>
			</header>
			<div className="space-y-4 p-4">
				<div className="max-w-xl space-y-2">
					<h3 className="font-medium">Browser session</h3>
					<p className="text-sm leading-6 text-muted-foreground">
						Log out of this browser. The owner password and API tokens stay unchanged.
					</p>
				</div>
				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				<Button disabled={loggingOut} onClick={logout} type="button" variant="destructive">
					{loggingOut ? "Logging out…" : "Log out"}
				</Button>
			</div>
		</section>
	);
}
