import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createRhoPrisma, type RhoPrisma } from "@rho/core";

export interface RhoAuthOptions {
	databaseUrl: string;
	ownerToken: string;
}

export interface RhoAuthPrincipal {
	kind: "session" | "api-token";
	id: string;
}

export interface RhoAuthSession {
	principal: RhoAuthPrincipal;
	token: string;
	expiresAt: Date;
	maxAgeSeconds: number;
}

export type RhoAuthSetupResult =
	| { status: "created"; session: RhoAuthSession }
	| { status: "already-complete" }
	| { status: "unauthorized" };

export interface ApiTokenSummary {
	id: string;
	name: string;
	tokenPrefix: string;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date;
}

export interface CreatedApiToken {
	token: string;
	apiToken: Pick<ApiTokenSummary, "id" | "name" | "tokenPrefix" | "createdAt">;
}

export interface RhoTokenSession {
	accessToken: string;
	refreshToken: string;
	accessExpiresAt: Date;
	refreshExpiresAt: Date;
	principal: RhoAuthPrincipal;
}

export interface RhoAuth {
	setupRequired(): Promise<boolean>;
	setup(input: { ownerToken: string; password: string }): Promise<RhoAuthSetupResult>;
	login(input: { password: string }): Promise<RhoAuthSession | undefined>;
	logout(sessionToken: string | undefined): Promise<void>;
	getToken(input: { password: string }): Promise<RhoTokenSession | undefined>;
	refreshToken(refreshToken: string): Promise<RhoTokenSession | undefined>;
	revokeToken(refreshToken: string): Promise<void>;
	authorize(input: { bearerToken?: string; sessionToken?: string }): Promise<RhoAuthPrincipal | undefined>;
	listApiTokens(): Promise<ApiTokenSummary[]>;
	createApiToken(input: { name: string }): Promise<CreatedApiToken>;
	revokeApiToken(id: string): Promise<void>;
}

const scryptAsync = promisify(scrypt);
export const authSessionCookieName = "rho_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
const accessTokenMaxAgeSeconds = 60 * 15;
const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 30;
const apiTokenPrefix = "rho_";
const passwordHashPrefix = "scrypt";

export function createRhoAuth(options: RhoAuthOptions): RhoAuth {
	const prisma = createRhoPrisma(options.databaseUrl);

	return {
		setupRequired: () => setupRequired(prisma),
		setup: (input) => setup(prisma, options.ownerToken, input),
		login: (input) => login(prisma, options.ownerToken, input),
		getToken: (input) => getToken(prisma, options.ownerToken, input),
		refreshToken: (token) => refreshToken(prisma, options.ownerToken, token),
		revokeToken: (token) => revokeToken(prisma, options.ownerToken, token),
		logout: (sessionToken) => logout(prisma, options.ownerToken, sessionToken),
		authorize: (input) => authorize(prisma, options.ownerToken, input),
		listApiTokens: () => listApiTokens(prisma),
		createApiToken: (input) => createApiToken(prisma, options.ownerToken, input),
		revokeApiToken: (id) => revokeApiToken(prisma, id),
	};
}

async function setupRequired(prisma: RhoPrisma): Promise<boolean> {
	return !(await ownerExists(prisma));
}

async function setup(
	prisma: RhoPrisma,
	ownerToken: string,
	input: { ownerToken: string; password: string },
): Promise<RhoAuthSetupResult> {
	if (await ownerExists(prisma)) {
		return { status: "already-complete" };
	}
	if (!validPassword(input.password) || !safeEqual(input.ownerToken, ownerToken)) {
		return { status: "unauthorized" };
	}

	await prisma.systemOwner.create({
		data: {
			id: 1,
			passwordHash: await hashPassword(ownerToken, input.password),
			setupCompletedAt: new Date(),
		},
	});

	return { status: "created", session: await createSession(prisma, ownerToken) };
}

async function login(
	prisma: RhoPrisma,
	ownerToken: string,
	input: { password: string },
): Promise<RhoAuthSession | undefined> {
	const owner = await prisma.systemOwner.findUnique({ where: { id: 1 } });
	if (!owner) {
		return undefined;
	}
	if (!(await verifyPassword(ownerToken, input.password, owner.passwordHash))) {
		return undefined;
	}

	return createSession(prisma, ownerToken);
}

async function getToken(
	prisma: RhoPrisma,
	ownerToken: string,
	input: { password: string },
): Promise<RhoTokenSession | undefined> {
	const owner = await prisma.systemOwner.findUnique({ where: { id: 1 } });
	if (!owner) {
		return undefined;
	}
	if (!(await verifyPassword(ownerToken, input.password, owner.passwordHash))) {
		return undefined;
	}

	return createToken(prisma, ownerToken);
}

async function createToken(prisma: RhoPrisma, ownerToken: string): Promise<RhoTokenSession> {
	const accessToken = randomToken();
	const refreshToken = randomToken();
	const accessExpiresAt = new Date(Date.now() + accessTokenMaxAgeSeconds * 1000);
	const refreshExpiresAt = new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000);
	const session = await prisma.systemSession.create({
		data: {
			id: crypto.randomUUID(),
			accessTokenHash: tokenHash(ownerToken, "session-access", accessToken),
			refreshTokenHash: tokenHash(ownerToken, "session-refresh", refreshToken),
			accessExpiresAt,
			refreshExpiresAt,
		},
	});

	return {
		accessToken,
		refreshToken,
		accessExpiresAt,
		refreshExpiresAt,
		principal: { kind: "session", id: session.id },
	};
}

async function refreshToken(
	prisma: RhoPrisma,
	ownerToken: string,
	refreshToken: string,
): Promise<RhoTokenSession | undefined> {
	const session = await prisma.systemSession.findUnique({
		where: { refreshTokenHash: tokenHash(ownerToken, "session-refresh", refreshToken) },
		select: { id: true, refreshExpiresAt: true, revokedAt: true },
	});
	if (!session || session.revokedAt || !session.refreshExpiresAt || session.refreshExpiresAt <= new Date()) {
		return undefined;
	}

	const nextAccessToken = randomToken();
	const nextRefreshToken = randomToken();
	const accessExpiresAt = new Date(Date.now() + accessTokenMaxAgeSeconds * 1000);
	const refreshExpiresAt = new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000);
	await prisma.systemSession.update({
		where: { id: session.id },
		data: {
			accessTokenHash: tokenHash(ownerToken, "session-access", nextAccessToken),
			refreshTokenHash: tokenHash(ownerToken, "session-refresh", nextRefreshToken),
			accessExpiresAt,
			refreshExpiresAt,
			lastUsedAt: new Date(),
		},
	});

	return {
		accessToken: nextAccessToken,
		refreshToken: nextRefreshToken,
		accessExpiresAt,
		refreshExpiresAt,
		principal: { kind: "session", id: session.id },
	};
}

async function revokeToken(prisma: RhoPrisma, ownerToken: string, refreshToken: string): Promise<void> {
	await prisma.systemSession.updateMany({
		where: { refreshTokenHash: tokenHash(ownerToken, "session-refresh", refreshToken) },
		data: { revokedAt: new Date() },
	});
}

async function createSession(prisma: RhoPrisma, ownerToken: string): Promise<RhoAuthSession> {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);
	const session = await prisma.systemSession.create({
		data: {
			id: crypto.randomUUID(),
			accessTokenHash: tokenHash(ownerToken, "session", token),
			accessExpiresAt: expiresAt,
		},
	});

	return {
		principal: { kind: "session", id: session.id },
		token,
		expiresAt,
		maxAgeSeconds: sessionMaxAgeSeconds,
	};
}

async function logout(
	prisma: RhoPrisma,
	ownerToken: string,
	sessionToken: string | undefined,
): Promise<void> {
	if (!sessionToken) {
		return;
	}

	await prisma.systemSession.deleteMany({
		where: { accessTokenHash: tokenHash(ownerToken, "session", sessionToken) },
	});
}

async function authorize(
	prisma: RhoPrisma,
	ownerToken: string,
	input: { bearerToken?: string; sessionToken?: string },
): Promise<RhoAuthPrincipal | undefined> {
	if (input.bearerToken) {
		const apiPrincipal = await authorizeApiToken(prisma, ownerToken, input.bearerToken);
		if (apiPrincipal) {
			return apiPrincipal;
		}

		return authorizeTokenSession(prisma, ownerToken, input.bearerToken);
	}
	if (input.sessionToken) {
		return authorizeSession(prisma, ownerToken, input.sessionToken);
	}

	return undefined;
}

async function listApiTokens(prisma: RhoPrisma): Promise<ApiTokenSummary[]> {
	return prisma.systemApiToken.findMany({
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			tokenPrefix: true,
			revokedAt: true,
			lastUsedAt: true,
			createdAt: true,
		},
	});
}

async function createApiToken(
	prisma: RhoPrisma,
	ownerToken: string,
	input: { name: string },
): Promise<CreatedApiToken> {
	const name = input.name.trim();
	if (!name) {
		throw new Error("Token name is required");
	}

	const token = `${apiTokenPrefix}${randomToken()}`;
	const apiToken = await prisma.systemApiToken.create({
		data: {
			id: crypto.randomUUID(),
			name,
			tokenHash: tokenHash(ownerToken, "api", token),
			tokenPrefix: token.slice(0, 12),
		},
	});

	return {
		token,
		apiToken: {
			id: apiToken.id,
			name: apiToken.name,
			tokenPrefix: apiToken.tokenPrefix,
			createdAt: apiToken.createdAt,
		},
	};
}

async function revokeApiToken(prisma: RhoPrisma, id: string): Promise<void> {
	await prisma.systemApiToken.updateMany({
		where: { id },
		data: { revokedAt: new Date() },
	});
}

async function authorizeSession(
	prisma: RhoPrisma,
	ownerToken: string,
	sessionToken: string,
): Promise<RhoAuthPrincipal | undefined> {
	const session = await prisma.systemSession.findUnique({
		where: { accessTokenHash: tokenHash(ownerToken, "session", sessionToken) },
		select: { id: true, accessExpiresAt: true },
	});
	if (!session) {
		return undefined;
	}

	if (session.accessExpiresAt <= new Date()) {
		await prisma.systemSession.delete({ where: { id: session.id } });
		return undefined;
	}

	return { kind: "session", id: session.id };
}

async function authorizeApiToken(
	prisma: RhoPrisma,
	ownerToken: string,
	apiToken: string,
): Promise<RhoAuthPrincipal | undefined> {
	const token = await prisma.systemApiToken.findUnique({
		where: { tokenHash: tokenHash(ownerToken, "api", apiToken) },
		select: { id: true, revokedAt: true },
	});
	if (!token || token.revokedAt) {
		return undefined;
	}

	await prisma.systemApiToken.update({
		where: { id: token.id },
		data: { lastUsedAt: new Date() },
	});

	return { kind: "api-token", id: token.id };
}

async function authorizeTokenSession(
	prisma: RhoPrisma,
	ownerToken: string,
	accessToken: string,
): Promise<RhoAuthPrincipal | undefined> {
	const session = await prisma.systemSession.findUnique({
		where: { accessTokenHash: tokenHash(ownerToken, "session-access", accessToken) },
		select: { id: true, accessExpiresAt: true, refreshExpiresAt: true, revokedAt: true },
	});
	if (!session || session.revokedAt) {
		return undefined;
	}

	const now = new Date();
	if (session.accessExpiresAt <= now || !session.refreshExpiresAt || session.refreshExpiresAt <= now) {
		return undefined;
	}

	await prisma.systemSession.update({
		where: { id: session.id },
		data: { lastUsedAt: now },
	});

	return { kind: "session", id: session.id };
}

async function ownerExists(prisma: RhoPrisma): Promise<boolean> {
	return Boolean(await prisma.systemOwner.findUnique({ where: { id: 1 }, select: { id: true } }));
}

function validPassword(value: string): boolean {
	return value.length >= 8;
}

async function hashPassword(ownerToken: string, password: string): Promise<string> {
	const salt = randomToken();
	const derived = (await scryptAsync(passwordSecret(ownerToken, password), salt, 64)) as Buffer;
	return [passwordHashPrefix, salt, derived.toString("base64url")].join("$");
}

async function verifyPassword(ownerToken: string, password: string, hash: string): Promise<boolean> {
	const [prefix, salt, value] = hash.split("$");
	if (prefix !== passwordHashPrefix || !salt || !value) {
		return false;
	}

	const expected = Buffer.from(value, "base64url");
	const actual = (await scryptAsync(passwordSecret(ownerToken, password), salt, expected.length)) as Buffer;
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function passwordSecret(ownerToken: string, password: string): string {
	return createHmac("sha256", ownerToken).update("password").update("\0").update(password).digest("base64url");
}

function tokenHash(
	ownerToken: string,
	purpose: "api" | "session" | "session-access" | "session-refresh",
	token: string,
): string {
	return createHmac("sha256", ownerToken).update(purpose).update("\0").update(token).digest("base64url");
}

function randomToken(): string {
	return randomBytes(32).toString("base64url");
}

function safeEqual(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
