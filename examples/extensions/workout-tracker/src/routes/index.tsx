import { useEffect, useState } from "react";
import { useRhoApp } from "@rho/apps-sdk/react";

interface SummaryResponse {
	summary: {
		week: string;
		completed: number;
		planned: number;
	};
	platform: string;
}

export function Home() {
	const rho = useRhoApp();
	const [data, setData] = useState<SummaryResponse>();

	useEffect(() => {
		rho
			.apiFetch("/summary")
			.then((response) => response.json() as Promise<SummaryResponse>)
			.then(setData)
			.catch(() => undefined);
	}, [rho]);

	return (
		<main className="space-y-4">
			<div>
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Workout Tracker
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">Training dashboard</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					Running inside rho on {rho.host.platform}.
				</p>
			</div>

			<div className="grid gap-2 sm:grid-cols-3">
				<Metric label="Completed" value={data?.summary.completed ?? "—"} />
				<Metric label="Planned" value={data?.summary.planned ?? "—"} />
				<Metric label="API host" value={data?.platform ?? "—"} />
			</div>
		</main>
	);
}

function Metric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="bg-background p-3 ring-1 ring-border/80">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
		</div>
	);
}
