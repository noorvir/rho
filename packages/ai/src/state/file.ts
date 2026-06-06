import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir, SessionManager } from "@earendil-works/pi-coding-agent";
import type { ConversationKey, ConversationState, StateManager } from "./types.ts";

interface StateIndex {
	conversations: Record<string, ConversationState>;
}

export interface FileStateManagerOptions {
	cwd?: string;
	rootDir?: string;
}

export class FileStateManager implements StateManager {
	private readonly cwd: string;
	private readonly rootDir: string;
	private readonly indexPath: string;
	private readonly sessionsDir: string;

	constructor(options: FileStateManagerOptions = {}) {
		this.cwd = options.cwd ?? process.cwd();
		this.rootDir = options.rootDir ?? process.env.RHO_STATE_DIR ?? join(getAgentDir(), "rho-state");
		this.indexPath = join(this.rootDir, "conversations.json");
		this.sessionsDir = join(this.rootDir, "sessions");
	}

	async resolve(key: ConversationKey): Promise<ConversationState> {
		const index = this.loadIndex();
		const existing = index.conversations[key];
		if (existing && existsSync(existing.sessionFile)) {
			return existing;
		}

		const sessionManager = SessionManager.create(this.cwd, this.sessionsDir);
		const sessionFile = sessionManager.getSessionFile();
		if (!sessionFile) {
			throw new Error("Pi did not create a session file");
		}

		const state = { key, sessionFile };
		index.conversations[key] = state;
		this.saveIndex(index);
		return state;
	}

	private loadIndex(): StateIndex {
		if (!existsSync(this.indexPath)) {
			return { conversations: {} };
		}

		const parsed = JSON.parse(readFileSync(this.indexPath, "utf8")) as StateIndex;
		return { conversations: parsed.conversations ?? {} };
	}

	private saveIndex(index: StateIndex): void {
		mkdirSync(dirname(this.indexPath), { recursive: true });
		writeFileSync(this.indexPath, `${JSON.stringify(index, null, 2)}\n`);
	}
}

export function createFileStateManager(options?: FileStateManagerOptions): FileStateManager {
	return new FileStateManager(options);
}
