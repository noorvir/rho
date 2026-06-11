import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useState } from "react";
import { useApi } from "../client.ts";

export function Todos() {
	const api = useApi();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");

	const todos = useQuery(api.list.queryOptions());

	const refresh = () => queryClient.invalidateQueries({ queryKey: api.list.key() });
	const create = useMutation(api.create.mutationOptions({ onSuccess: refresh }));
	const toggle = useMutation(api.toggle.mutationOptions({ onSuccess: refresh }));
	const remove = useMutation(api.remove.mutationOptions({ onSuccess: refresh }));

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) {
			return;
		}
		create.mutate({ title: trimmed }, { onSuccess: () => setTitle("") });
	}

	return (
		<Screen title="Todos">
			<form className="flex gap-2" onSubmit={submit}>
				<TextInput
					onChange={(event) => setTitle(event.target.value)}
					placeholder="What needs doing?"
					value={title}
				/>
				<Button disabled={create.isPending} type="submit">
					Add
				</Button>
			</form>

			{todos.isPending && <LoadingState />}
			{todos.isError && <ErrorState description="Could not load todos. Please try again." />}
			{todos.data && todos.data.todos.length === 0 && (
				<EmptyState title="Nothing here yet" description="Add your first todo above." />
			)}

			{todos.data && todos.data.todos.length > 0 && (
				<List>
					{todos.data.todos.map((todo) => (
						<Row
							key={todo.id}
							leading={
								<Checkbox
									checked={todo.completed}
									onChange={(event) =>
										toggle.mutate({ id: todo.id, completed: event.target.checked })
									}
								/>
							}
							title={
								<span className={todo.completed ? "text-muted-foreground line-through" : undefined}>
									{todo.title}
								</span>
							}
							trailing={
								<Button
									disabled={remove.isPending}
									onClick={() => remove.mutate({ id: todo.id })}
									size="sm"
									variant="destructive"
								>
									Delete
								</Button>
							}
						/>
					))}
				</List>
			)}
		</Screen>
	);
}
