import type { RhoModelDelegate } from "@rho/apps-sdk";

interface PlannedExercise {
	id: number;
	date: string;
	name: string;
	details: string | null;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

declare module "@rho/core" {
	interface RhoRuntimeModels {
		plannedExercise: RhoModelDelegate<PlannedExercise>;
	}
}
