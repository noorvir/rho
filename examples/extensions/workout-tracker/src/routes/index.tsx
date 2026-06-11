import { useQuery } from "@tanstack/react-query";
import { useRhoApp } from "@rho/apps-sdk/react";
import { useApi } from "../client.ts";

interface WeekDay {
	date: string;
	label: string;
	shortLabel: string;
}

export function Home() {
	const rho = useRhoApp();
	const api = useApi();
	const days = currentWeekDays();
	const week = useQuery(
		api.week.queryOptions({
			input: {
				startDate: days[0].date,
				endDate: days[days.length - 1].date,
			},
		}),
	);

	return (
		<main className="space-y-4">
			<div>
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Workout Tracker
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">This week</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					Pick a day to see the planned exercises.
				</p>
			</div>

			{week.isPending && <p className="text-sm text-muted-foreground">Loading your plan…</p>}
			{week.isError && (
				<p className="text-sm text-red-600">Could not load your workout plan. Please try again.</p>
			)}

			<div className="grid gap-2 md:grid-cols-7">
				{days.map((day) => {
					const exercises = week.data?.exercises.filter((exercise) => exercise.date === day.date) ?? [];
					return (
						<a
							className="block bg-background p-3 ring-1 ring-border/80 transition hover:bg-muted/60"
							href={`${rho.app.basePath}/day/${day.date}`}
							key={day.date}
							onClick={(event) => {
								event.preventDefault();
								rho.navigate(`/day/${day.date}`);
							}}
						>
							<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
								{day.shortLabel}
							</p>
							<h3 className="mt-1 text-lg font-semibold tracking-tight">{day.label}</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								{exercises.length === 0
									? "No exercises planned"
									: `${exercises.length} planned ${exercises.length === 1 ? "exercise" : "exercises"}`}
							</p>
							{exercises.length > 0 && (
								<p className="mt-1 truncate text-sm font-medium">{exercises[0].name}</p>
							)}
						</a>
					);
				})}
			</div>
		</main>
	);
}

function currentWeekDays(): WeekDay[] {
	const today = new Date();
	const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
	const day = start.getUTCDay();
	const daysSinceMonday = day === 0 ? 6 : day - 1;
	start.setUTCDate(start.getUTCDate() - daysSinceMonday);

	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return {
			date: formatDate(date),
			label: date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" }),
			shortLabel: date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
		};
	});
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
