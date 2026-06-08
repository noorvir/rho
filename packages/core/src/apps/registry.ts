import type { AppExtension } from "./types.ts";

export class AppRegistry {
	private apps: AppExtension[];

	constructor(apps: AppExtension[] = []) {
		this.apps = [...apps];
	}

	current(): AppExtension[] {
		return [...this.apps];
	}

	replace(apps: AppExtension[]): void {
		this.apps = [...apps];
	}
}
