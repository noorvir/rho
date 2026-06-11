import type { ReadingStatus } from "./api.ts";

export const statusOrder: ReadingStatus[] = ["currently_reading", "want_to_read", "finished"];

export const statusLabels: Record<ReadingStatus, string> = {
	want_to_read: "Want to read",
	currently_reading: "Currently reading",
	finished: "Finished",
};
