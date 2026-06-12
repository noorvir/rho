import {
	Button,
	Checkbox,
	EmptyState,
	ErrorState,
	List,
	LoadingState,
	Row,
	Screen,
	TextInput,
} from "@rho/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApi } from "../client.ts";

export function Today() {
	const api = useApi();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");

	const today = useQuery(api.today.queryOptions());

	const refresh = () => queryClient.invalidateQueries({ queryKey: api.today.key() });
	const create = useMutation(api.create.mutationOptions({ onSuccess: refresh }));
	const remove = useMutation(api.remove.mutationOptions({ onSuccess: refresh }));
	const setDone = useMutation(api.setDone.mutationOptions({ onSuccess: refresh }));

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		create.mutate({ name: trimmed }, { onSuccess: () => setName("") });
	}

	return (
		<Screen title="Today's Habits">
			<form className="flex gap-2" onSubmit={submit}>
				<TextInput
					onChange={(event) => setName(event.target.value)}
					placeholder="Add a daily habit, e.g. drink water"
					value={name}
				/>
				<Button disabled={create.isPending} type="submit">
					Add
				</Button>
			</form>

			{today.isPending && <LoadingState />}
			{today.isError && <ErrorState description="Could not load habits. Please try again." />}
			{today.data && today.data.habits.length === 0 && (
				<EmptyState
					title="No habits yet"
					description="Add your first daily habit above."
				/>
			)}

			{today.data && today.data.habits.length > 0 && (
				<List>
					{today.data.habits.map((habit) => (
						<Row
							key={habit.id}
							leading={
								<Checkbox
									checked={habit.done}
									onChange={(event) =>
										setDone.mutate({ id: habit.id, done: event.target.checked })
									}
								/>
							}
							title={
								<span className={habit.done ? "text-muted-foreground line-through" : undefined}>
									{habit.name}
								</span>
							}
							trailing={
								<Button
									disabled={remove.isPending}
									onClick={() => remove.mutate({ id: habit.id })}
									size="sm"
									variant="destructive"
								>
									Remove
								</Button>
							}
						/>
					))}
				</List>
			)}
		</Screen>
	);
}
