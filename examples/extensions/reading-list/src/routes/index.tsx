import {
	Button,
	EmptyState,
	ErrorState,
	Field,
	List,
	LoadingState,
	Row,
	Screen,
	Section,
	TextInput,
} from "@rho/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import type { ReadingStatus } from "../api.ts";
import { useApi } from "../client.ts";
import { statusLabels, statusOrder } from "../status.ts";

export function Books() {
	const api = useApi();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [author, setAuthor] = useState("");

	const books = useQuery(api.list.queryOptions());
	const create = useMutation(
		api.create.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: api.list.key() }),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedTitle = title.trim();
		const trimmedAuthor = author.trim();
		if (!trimmedTitle || !trimmedAuthor) {
			return;
		}
		create.mutate(
			{ title: trimmedTitle, author: trimmedAuthor },
			{
				onSuccess: () => {
					setTitle("");
					setAuthor("");
				},
			},
		);
	}

	const all = books.data?.books ?? [];
	const grouped = new Map<ReadingStatus, typeof all>(
		statusOrder.map((status) => [status, all.filter((book) => book.status === status)]),
	);

	return (
		<Screen title="Reading List">
			<Section title="Add a book">
				<form className="space-y-3" onSubmit={submit}>
					<Field label="Title">
						<TextInput
							onChange={(event) => setTitle(event.target.value)}
							placeholder="The Name of the Rose"
							value={title}
						/>
					</Field>
					<Field label="Author">
						<TextInput
							onChange={(event) => setAuthor(event.target.value)}
							placeholder="Umberto Eco"
							value={author}
						/>
					</Field>
					<Button disabled={create.isPending} type="submit">
						Add book
					</Button>
				</form>
			</Section>

			{books.isPending && <LoadingState />}
			{books.isError && <ErrorState description="Could not load your books. Please try again." />}
			{books.isSuccess && all.length === 0 && (
				<EmptyState title="No books yet" description="Add your first book above." />
			)}

			{statusOrder.map((status) => {
				const group = grouped.get(status) ?? [];
				if (group.length === 0) {
					return null;
				}
				return (
					<Section key={status} title={statusLabels[status]}>
						<List>
							{group.map((book) => (
								<Row
									key={book.id}
									href={`/book/${book.id}`}
									subtitle={book.author}
									title={book.title}
								/>
							))}
						</List>
					</Section>
				);
			})}
		</Screen>
	);
}
