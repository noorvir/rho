import { useEffect, useState } from "react";
import { useRhoApp } from "@rho/apps-sdk/react";

interface Workout {
	id: string;
	name: string;
	minutes: number;
	focus: string;
}

interface WorkoutsResponse {
	workouts: Workout[];
}

export function Workouts() {
	const rho = useRhoApp();
	const [workouts, setWorkouts] = useState<Workout[]>([]);

	useEffect(() => {
		rho
			.apiFetch("/workouts")
			.then((response) => response.json() as Promise<WorkoutsResponse>)
			.then((data) => setWorkouts(data.workouts))
			.catch(() => setWorkouts([]));
	}, [rho]);

	return (
		<main>
			<div>
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Workout Tracker
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">Workouts</h2>
			</div>

			<div className="mt-4 grid gap-2">
				{workouts.map((workout) => (
					<article className="bg-background p-3 ring-1 ring-border/80" key={workout.id}>
						<div className="flex items-center justify-between gap-3">
							<h3 className="text-sm font-semibold">{workout.name}</h3>
							<p className="text-xs text-muted-foreground">{workout.minutes} min</p>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">{workout.focus}</p>
					</article>
				))}
			</div>
		</main>
	);
}
