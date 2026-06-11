import { useQuery } from "@tanstack/react-query";
import { Badge, ErrorState, List, LoadingState, Row, Screen, Section } from "@rho/ui";
import { useApi } from "../client.ts";

interface WeekDay {
	date: string;
	label: string;
	shortLabel: string;
}

export function Home() {
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
	const planned = week.data?.exercises ?? [];

	return (
		<Screen description="Pick a day to see the planned exercises." title="This week">
			{week.isPending && <LoadingState />}
			{week.isError && (
				<ErrorState description="Could not load your workout plan. Please try again." />
			)}

			{week.isSuccess && (
				<Section>
					<List>
						{days.map((day) => {
							const exercises = planned.filter((exercise) => exercise.date === day.date);
							const summary =
								exercises.length === 0
									? "Rest day"
									: exercises.map((exercise) => exercise.name).join(", ");
							return (
								<Row
									href={`/day/${day.date}`}
									key={day.date}
									leading={
										<span className="w-10 text-xs font-medium uppercase text-muted-foreground">
											{day.shortLabel}
										</span>
									}
									subtitle={summary}
									title={day.label}
									trailing={exercises.length > 0 && <Badge>{exercises.length}</Badge>}
								/>
							);
						})}
					</List>
				</Section>
			)}
		</Screen>
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
