import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

/**
 * Rho's blob store: a plain directory tree where store-relative paths are the
 * identity clients, history, and the agent all share. Conversation uploads
 * land under `uploads/sessions/<session-id>/`.
 */
export interface RhoStore {
	root: string;
	saveUpload(input: StoreUploadInput): Promise<string>;
	/** Resolves a store-relative path to an absolute path, rejecting paths that escape the store root. */
	resolve(path: string): string;
}

export interface StoreUploadInput {
	sessionId: string;
	mimeType: string;
	data: Uint8Array;
}

const extensionsByMimeType: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/heic": "heic",
	"audio/mp4": "m4a",
	"audio/m4a": "m4a",
	"audio/mpeg": "mp3",
	"audio/wav": "wav",
	"application/pdf": "pdf",
	"text/plain": "txt",
	"text/markdown": "md",
};

const mimeTypesByExtension = Object.fromEntries(
	Object.entries(extensionsByMimeType).map(([mimeType, extension]) => [extension, mimeType]),
);

export function storeMimeType(path: string): string {
	const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
	return mimeTypesByExtension[extension] ?? "application/octet-stream";
}

export function createRhoStore(root: string): RhoStore {
	const resolvedRoot = resolve(root);

	const resolvePath = (path: string): string => {
		const absolute = resolve(resolvedRoot, path);
		if (absolute !== resolvedRoot && !absolute.startsWith(resolvedRoot + sep)) {
			throw new Error(`Store path escapes the store root: ${path}`);
		}
		return absolute;
	};

	return {
		root: resolvedRoot,

		async saveUpload(input) {
			const extension = extensionsByMimeType[input.mimeType];
			if (!extension) {
				throw new Error(`Unsupported upload mime type: ${input.mimeType}`);
			}

			const sessionId = sanitizeSessionId(input.sessionId);
			const path = `uploads/sessions/${sessionId}/${crypto.randomUUID()}.${extension}`;
			const absolute = resolvePath(path);

			await mkdir(join(resolvedRoot, "uploads", "sessions", sessionId), { recursive: true });
			await writeFile(absolute, input.data);
			return path;
		},

		resolve: resolvePath,
	};
}

function sanitizeSessionId(sessionId: string): string {
	const cleaned = sessionId.replace(/[^a-zA-Z0-9._-]/g, "-");
	if (!cleaned || cleaned !== sessionId) {
		throw new Error(`Invalid session id for upload: ${sessionId}`);
	}
	return cleaned;
}
