import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Button,
	EmptyState,
	ErrorState,
	Field,
	Link,
	List,
	LoadingState,
	Row,
	Screen,
	Section,
	TextInput,
} from "@rho/ui";
import type { FormEvent } from "react";
import { useState } from "react";
import { useApi } from "../client.ts";

interface DayProps {
	date: string;
}

export function Day({ date }: DayProps) {
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

	const exercises = day.data?.exercises ?? [];

	return (
		<div className="mx-auto w-full max-w-3xl space-y-4">
			<Link className="text-sm text-muted-foreground hover:text-foreground" href="/">
				← Back to week
			</Link>

			<Screen description="Planned exercises for this day." title={formatDayTitle(date)}>
				<Section title="Planned">
					{day.isPending && <LoadingState />}
					{day.isError && <ErrorState description="Could not load this day. Please try again." />}
					{day.isSuccess && exercises.length === 0 && (
						<EmptyState title="Nothing planned yet" description="Add the first exercise below." />
					)}
					{exercises.length > 0 && (
						<List>
							{exercises.map((exercise) => (
								<Row key={exercise.id} subtitle={exercise.details} title={exercise.name} />
							))}
						</List>
					)}
				</Section>

				<Section title="Add exercise">
					<form className="space-y-3" onSubmit={submit}>
						<Field label="Exercise">
							<TextInput
								onChange={(event) => setName(event.target.value)}
								placeholder="Bench press"
								value={name}
							/>
						</Field>
						<Field label="Notes" help="Optional — sets, reps, weight.">
							<TextInput
								onChange={(event) => setDetails(event.target.value)}
								placeholder="3 sets of 8, moderate weight"
								value={details}
							/>
						</Field>
						<Button disabled={create.isPending} type="submit">
							Add exercise
						</Button>
					</form>
				</Section>
			</Screen>
		</div>
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
