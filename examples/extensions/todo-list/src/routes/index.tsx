import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
		<main className="space-y-4">
			<div>
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Todo List
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">Todos</h2>
			</div>

			<form className="flex gap-2" onSubmit={submit}>
				<input
					className="flex-1 bg-background px-3 py-2 text-sm ring-1 ring-border/80 focus:outline-none focus:ring-2"
					onChange={(event) => setTitle(event.target.value)}
					placeholder="What needs doing?"
					value={title}
				/>
				<button
					className="bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
					disabled={create.isPending}
					type="submit"
				>
					Add
				</button>
			</form>

			{todos.isPending && <p className="text-sm text-muted-foreground">Loading todos…</p>}
			{todos.isError && (
				<p className="text-sm text-red-600">Could not load todos. Please try again.</p>
			)}
			{todos.data && todos.data.todos.length === 0 && (
				<p className="text-sm text-muted-foreground">Nothing here yet. Add your first todo above.</p>
			)}

			<ul className="grid gap-2">
				{(todos.data?.todos ?? []).map((todo) => (
					<li
						className="flex items-center gap-3 bg-background p-3 ring-1 ring-border/80"
						key={todo.id}
					>
						<input
							checked={todo.completed}
							className="size-4 accent-green-600"
							onChange={(event) =>
								toggle.mutate({ id: todo.id, completed: event.target.checked })
							}
							type="checkbox"
						/>
						<span
							className={
								todo.completed
									? "flex-1 text-sm text-muted-foreground line-through"
									: "flex-1 text-sm"
							}
						>
							{todo.title}
						</span>
						<button
							className="text-xs text-muted-foreground hover:text-red-600 disabled:opacity-50"
							disabled={remove.isPending}
							onClick={() => remove.mutate({ id: todo.id })}
							type="button"
						>
							Delete
						</button>
					</li>
				))}
			</ul>
		</main>
	);
}
