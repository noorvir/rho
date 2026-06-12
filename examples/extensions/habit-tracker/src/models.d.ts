import type { RhoModelDelegate } from "@rho/apps-sdk";

interface HabitCompletion {
	id: number;
	habitId: number;
	date: string;
	completedAt: Date;
}

interface Habit {
	id: number;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	/** Present when queried with `include: { completions }`. */
	completions: HabitCompletion[];
}

declare module "@rho/core" {
	interface RhoRuntimeModels {
		habit: RhoModelDelegate<Habit>;
		habitCompletion: RhoModelDelegate<HabitCompletion>;
	}
}
