import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { implement } from "@orpc/server";
import { tc } from "@rho/lib";
import { throwRhoError } from "../errors.ts";
import { storeMimeType } from "../store.ts";
import { requireAuth } from "./auth.ts";
import { httpContract } from "./contract.ts";
import type { HttpContext } from "./types.ts";

const p = implement(httpContract).$context<HttpContext>();

const maxUploadBytes = 20 * 1024 * 1024;

export function storeRouter() {
	return {
		upload: p.store.upload.handler(async ({ input, context }) => {
			await requireAuth(context);

			const data = tc(() => decodeBase64(input.data));
			if (data.error) {
				throwRhoError("request.invalid", { message: "Upload data must be valid base64." });
			}
			if (data.data.byteLength > maxUploadBytes) {
				throwRhoError("request.invalid", {
					message: `Upload exceeds the ${maxUploadBytes / 1024 / 1024} MB limit.`,
				});
			}

			const saved = await tc(
				context.store.saveUpload({
					sessionId: input.sessionId,
					mimeType: input.mimeType,
					data: data.data,
				}),
			);
			if (saved.error) {
				throwRhoError("request.invalid", { message: errorMessage(saved.error, "Failed to save upload") });
			}

			return { path: saved.data };
		}),

		download: p.store.download.handler(async ({ input, context }) => {
			await requireAuth(context);

			const absolute = tc(() => context.store.resolve(input.path));
			if (absolute.error) {
				throwRhoError("request.invalid", { message: "Invalid store path." });
			}

			const bytes = await tc(readFile(absolute.data));
			if (bytes.error) {
				throwRhoError("request.invalid", { message: `Store file not found: ${input.path}` });
			}

			const buffer = new Uint8Array(bytes.data);
			return new File([buffer], basename(input.path), { type: storeMimeType(input.path) });
		}),
	};
}

function decodeBase64(data: string): Uint8Array {
	return new Uint8Array(Buffer.from(data, "base64"));
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
}
