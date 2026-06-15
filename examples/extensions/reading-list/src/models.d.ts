import type { RhoModelDelegate } from "@rho/apps-sdk";

interface Book {
	id: number;
	title: string;
	author: string;
	status: "want_to_read" | "currently_reading" | "finished";
	createdAt: Date;
	updatedAt: Date;
}

declare module "@rho/apps-sdk" {
	interface RhoRuntimeModels {
		book: RhoModelDelegate<Book>;
	}
}
