import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadAuthSession, loadAuthSetup, loginAuth, setupAuth } from "./core-api.ts";

type AuthStatus =
	| { state: "loading" }
	| { state: "setup" }
	| { state: "login" }
	| { state: "authenticated" }
	| { state: "error"; message: string };

export function AuthGate({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>({ state: "loading" });

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const [setupRequired, session] = await Promise.all([loadAuthSetup(), loadAuthSession()]);
				if (cancelled) {
					return;
				}

				if (session.authenticated) {
					setStatus({ state: "authenticated" });
					return;
				}

				setStatus({ state: setupRequired ? "setup" : "login" });
			} catch (error) {
				if (!cancelled) {
					setStatus({ state: "error", message: errorMessage(error) });
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (status.state === "authenticated") {
		return children;
	}

	if (status.state === "loading") {
		return <AuthLayout title="Loading rho" description="Checking this workspace session." />;
	}

	if (status.state === "setup") {
		return <SetupForm onAuthenticated={() => setStatus({ state: "authenticated" })} />;
	}

	if (status.state === "login") {
		return <LoginForm onAuthenticated={() => setStatus({ state: "authenticated" })} />;
	}

	return <AuthLayout title="Could not load rho" description={status.message} />;
}

function SetupForm({ onAuthenticated }: { onAuthenticated: () => void }) {
	const [ownerToken, setOwnerToken] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string>();
	const [submitting, setSubmitting] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setSubmitting(true);
		setError(undefined);
		try {
			await setupAuth({ ownerToken, password });
			onAuthenticated();
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<AuthLayout
			title="Set up rho"
			description="Enter the deployment root secret once, then choose the owner password you will use for future browser logins."
		>
			<form className="mt-6 space-y-4" onSubmit={submit}>
				<Field label="Root secret">
					<Input
						autoComplete="off"
						name="ownerToken"
						onChange={(event) => setOwnerToken(event.target.value)}
						required
						type="password"
						value={ownerToken}
					/>
				</Field>
				<Field label="New password">
					<Input
						autoComplete="new-password"
						name="password"
						onChange={(event) => setPassword(event.target.value)}
						required
						type="password"
						value={password}
					/>
				</Field>
				<Field label="Confirm password">
					<Input
						autoComplete="new-password"
						name="confirmPassword"
						onChange={(event) => setConfirmPassword(event.target.value)}
						required
						type="password"
						value={confirmPassword}
					/>
				</Field>
				<AuthError message={error} />
				<Button className="w-full" disabled={submitting} type="submit">
					{submitting ? "Setting up…" : "Set password"}
				</Button>
			</form>
		</AuthLayout>
	);
}

function LoginForm({ onAuthenticated }: { onAuthenticated: () => void }) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string>();
	const [submitting, setSubmitting] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setError(undefined);
		try {
			await loginAuth({ password });
			onAuthenticated();
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<AuthLayout title="Log in to rho" description="Use the owner password for this workspace.">
			<form className="mt-6 space-y-4" onSubmit={submit}>
				<Field label="Password">
					<Input
						autoComplete="current-password"
						name="password"
						onChange={(event) => setPassword(event.target.value)}
						required
						type="password"
						value={password}
					/>
				</Field>
				<AuthError message={error} />
				<Button className="w-full" disabled={submitting} type="submit">
					{submitting ? "Logging in…" : "Log in"}
				</Button>
			</form>
		</AuthLayout>
	);
}

function AuthLayout({ children, description, title }: { children?: ReactNode; description: string; title: string }) {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
			<section className="w-full max-w-sm border border-border bg-card p-6 shadow-sm">
				<p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">rho</p>
				<h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
				{children}
			</section>
		</div>
	);
}

function Field({ children, label }: { children: ReactNode; label: string }) {
	return (
		<label className="block space-y-2 text-sm font-medium">
			<span>{label}</span>
			{children}
		</label>
	);
}

function AuthError({ message }: { message: string | undefined }) {
	if (!message) {
		return null;
	}

	return <p className="text-sm text-destructive">{message}</p>;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Something went wrong";
}
