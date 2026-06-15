import type { RhoModelDelegate } from "@rho/apps-sdk";

interface Todo {
	id: number;
	title: string;
	completed: boolean;
	createdAt: Date;
	updatedAt: Date;
}

declare module "@rho/apps-sdk" {
	interface RhoRuntimeModels {
		todo: RhoModelDelegate<Todo>;
	}
}
