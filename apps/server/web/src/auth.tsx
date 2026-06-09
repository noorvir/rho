import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { api } from "./api.ts";
import { AdminShell } from "./routes/admin-shell.tsx";

type AuthStatus =
	| { state: "loading" }
	| { state: "authenticated" }
	| { state: "unauthenticated" }
	| { state: "error"; message: string };

interface AuthContextValue {
	logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function ProtectedShell() {
	const location = useLocation();
	const navigate = useNavigate();
	const [status, setStatus] = useState<AuthStatus>({ state: "loading" });

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const session = await api.auth.session();
				if (cancelled) {
					return;
				}

				if (session.authenticated) {
					setStatus({ state: "authenticated" });
					return;
				}

				setStatus({ state: "unauthenticated" });
				void navigate({ to: "/login", search: { redirect: currentPath(location) } });
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
	}, [location, navigate]);

	async function logout() {
		await api.auth.logout();
		setStatus({ state: "unauthenticated" });
		await navigate({ to: "/login" });
	}

	if (status.state === "authenticated") {
		return (
			<AuthContext.Provider value={{ logout }}>
				<AdminShell />
			</AuthContext.Provider>
		);
	}

	if (status.state === "error") {
		return <AuthLayout title="Could not load rho" description={status.message} />;
	}

	return <AuthLayout title="Loading rho" description="Checking this workspace session." />;
}

export function useAuth() {
	const auth = useContext(AuthContext);
	if (!auth) {
		throw new Error("useAuth must be used inside ProtectedShell");
	}

	return auth;
}

export function AuthLayout({ children, description, title }: { children?: ReactNode; description: string; title: string }) {
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

export function Field({ children, label }: { children: ReactNode; label: string }) {
	return (
		<label className="block space-y-2 text-sm font-medium">
			<span>{label}</span>
			{children}
		</label>
	);
}

export function AuthError({ message }: { message: string | undefined }) {
	if (!message) {
		return null;
	}

	return <p className="text-sm text-destructive">{message}</p>;
}

export function redirectPath(): string {
	const params = new URLSearchParams(window.location.search);
	const redirect = params.get("redirect");
	if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
		return "/";
	}

	return redirect;
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Something went wrong";
}

function currentPath(location: ReturnType<typeof useLocation>): string {
	return `${location.pathname}${location.searchStr}`;
}
