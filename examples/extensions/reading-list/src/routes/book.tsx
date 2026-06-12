import { ErrorState, Field, LoadingState, Screen, Select } from "@rho/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readingStatus } from "../api.ts";
import { useApi } from "../client.ts";
import { statusLabels, statusOrder } from "../status.ts";

interface BookProps {
	id: number;
}

export function Book({ id }: BookProps) {
	const api = useApi();
	const queryClient = useQueryClient();

	const book = useQuery(api.get.queryOptions({ input: { id } }));
	const updateStatus = useMutation(
		api.updateStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: api.get.key({ input: { id } }) });
				queryClient.invalidateQueries({ queryKey: api.list.key() });
			},
		}),
	);

	function changeStatus(value: string) {
		const parsed = readingStatus.safeParse(value);
		if (!parsed.success) {
			return;
		}
		updateStatus.mutate({ id, status: parsed.data });
	}

	const loaded = book.data?.book;

	return (
		<Screen
			back={{ href: "/", label: "Back to books" }}
			description={loaded ? `by ${loaded.author}` : undefined}
			title={loaded?.title}
		>
			{book.isPending && <LoadingState />}
			{book.isError && <ErrorState description="Could not load this book. Please try again." />}
			{book.isSuccess && !book.data.book && (
				<ErrorState description="This book no longer exists." />
			)}

			{loaded && (
				<Field label="Status">
					<Select
						disabled={updateStatus.isPending}
						onChange={(event) => changeStatus(event.target.value)}
						value={loaded.status}
					>
						{statusOrder.map((status) => (
							<option key={status} value={status}>
								{statusLabels[status]}
							</option>
						))}
					</Select>
				</Field>
			)}
		</Screen>
	);
}
