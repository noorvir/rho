import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRhoApp } from "@rho/apps-sdk/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useApi } from "../client.ts";

interface DayProps {
	date: string;
}

export function Day({ date }: DayProps) {
	const rho = useRhoApp();
	const api = useApi();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [details, setDetails] = useState("");

	const day = useQuery(api.day.queryOptions({ input: { date } }));
	const create = useMutation(
		api.create.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: api.day.key({ input: { date } }) }),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}

		const trimmedDetails = details.trim();
		create.mutate(
			{
				date,
				name: trimmedName,
				details: trimmedDetails || undefined,
			},
			{
				onSuccess: () => {
					setName("");
					setDetails("");
				},
			},
		);
	}

	return (
		<main className="space-y-4">
			<div>
				<a
					className="text-sm text-muted-foreground hover:text-foreground"
					href={rho.app.basePath}
					onClick={(event) => {
						event.preventDefault();
						rho.navigate("/");
					}}
				>
					← Back to week
				</a>
				<p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Workout Tracker
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">{formatDayTitle(date)}</h2>
				<p className="mt-2 text-sm text-muted-foreground">Planned exercises for this day.</p>
			</div>

			<form className="grid gap-2 bg-background p-3 ring-1 ring-border/80" onSubmit={submit}>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Exercise</span>
					<input
						className="bg-background px-3 py-2 text-sm ring-1 ring-border/80 focus:outline-none focus:ring-2"
						onChange={(event) => setName(event.target.value)}
						placeholder="Bench press"
						value={name}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Notes</span>
					<input
						className="bg-background px-3 py-2 text-sm ring-1 ring-border/80 focus:outline-none focus:ring-2"
						onChange={(event) => setDetails(event.target.value)}
						placeholder="3 sets of 8, moderate weight"
						value={details}
					/>
				</label>
				<button
					className="justify-self-start bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
					disabled={create.isPending}
					type="submit"
				>
					Add exercise
				</button>
			</form>

			{day.isPending && <p className="text-sm text-muted-foreground">Loading exercises…</p>}
			{day.isError && (
				<p className="text-sm text-red-600">Could not load this day. Please try again.</p>
			)}
			{day.data && day.data.exercises.length === 0 && (
				<p className="text-sm text-muted-foreground">
					Nothing planned yet. Add the first exercise above.
				</p>
			)}

			<ul className="grid gap-2">
				{(day.data?.exercises ?? []).map((exercise) => (
					<li className="bg-background p-3 ring-1 ring-border/80" key={exercise.id}>
						<h3 className="text-sm font-semibold">{exercise.name}</h3>
						{exercise.details && (
							<p className="mt-1 text-sm text-muted-foreground">{exercise.details}</p>
						)}
					</li>
				))}
			</ul>
		</main>
	);
}

function formatDayTitle(date: string): string {
	return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		timeZone: "UTC",
		weekday: "long",
	});
}
