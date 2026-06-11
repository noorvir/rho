import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApi } from "../client.ts";

export function Contacts() {
	const api = useApi();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [notes, setNotes] = useState("");

	const contacts = useQuery(api.list.queryOptions());

	const refresh = () => queryClient.invalidateQueries({ queryKey: api.list.key() });
	const create = useMutation(api.create.mutationOptions({ onSuccess: refresh }));

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}

		create.mutate(
			{
				name: trimmedName,
				email: email.trim(),
				phone: phone.trim(),
				notes: notes.trim(),
			},
			{
				onSuccess: () => {
					setName("");
					setEmail("");
					setPhone("");
					setNotes("");
				},
			},
		);
	}

	return (
		<main className="space-y-5">
			<div>
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					Contacts
				</p>
				<h2 className="mt-1 text-2xl font-semibold tracking-tight">People</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					Keep names, email addresses, phone numbers, and quick notes in one place.
				</p>
			</div>

			<form className="grid gap-3 bg-background p-4 ring-1 ring-border/80" onSubmit={submit}>
				<div className="grid gap-3 md:grid-cols-2">
					<label className="grid gap-1 text-sm font-medium" htmlFor="contact-name">
						Name
						<input
							autoComplete="name"
							className="bg-background px-3 py-2 text-sm font-normal ring-1 ring-border/80 focus:outline-none focus:ring-2"
							id="contact-name"
							name="name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Ada Lovelace"
							value={name}
						/>
					</label>
					<label className="grid gap-1 text-sm font-medium" htmlFor="contact-email">
						Email
						<input
							autoComplete="email"
							className="bg-background px-3 py-2 text-sm font-normal ring-1 ring-border/80 focus:outline-none focus:ring-2"
							id="contact-email"
							name="email"
							onChange={(event) => setEmail(event.target.value)}
							placeholder="ada@example.com"
							type="email"
							value={email}
						/>
					</label>
				</div>
				<label className="grid gap-1 text-sm font-medium" htmlFor="contact-phone">
					Phone
					<input
						autoComplete="tel"
						className="bg-background px-3 py-2 text-sm font-normal ring-1 ring-border/80 focus:outline-none focus:ring-2"
						id="contact-phone"
						name="phone"
						onChange={(event) => setPhone(event.target.value)}
						placeholder="(555) 123-4567"
						value={phone}
					/>
				</label>
				<label className="grid gap-1 text-sm font-medium" htmlFor="contact-notes">
					Notes
					<textarea
						className="min-h-20 bg-background px-3 py-2 text-sm font-normal ring-1 ring-border/80 focus:outline-none focus:ring-2"
						id="contact-notes"
						name="notes"
						onChange={(event) => setNotes(event.target.value)}
						placeholder="How you know them, reminders, or anything useful."
						value={notes}
					/>
				</label>
				<button
					className="justify-self-start bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
					disabled={create.isPending}
					type="submit"
				>
					Add contact
				</button>
			</form>

			{contacts.isPending && <p className="text-sm text-muted-foreground">Loading contacts…</p>}
			{contacts.isError && (
				<p className="text-sm text-red-600">Could not load contacts. Please try again.</p>
			)}
			{contacts.data && contacts.data.contacts.length === 0 && (
				<p className="text-sm text-muted-foreground">
					No contacts yet. Add your first person above.
				</p>
			)}

			<ul className="grid gap-2">
				{(contacts.data?.contacts ?? []).map((contact) => (
					<li className="bg-background p-4 ring-1 ring-border/80" key={contact.id}>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<h3 className="text-lg font-semibold tracking-tight">{contact.name}</h3>
							{contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
						</div>
						{contact.email && <p className="mt-1 text-sm text-muted-foreground">{contact.email}</p>}
						{contact.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{contact.notes}</p>}
					</li>
				))}
			</ul>
		</main>
	);
}
