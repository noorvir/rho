// Plain object on purpose: this directory has no node_modules, so the config
// must not import anything. The runtime always passes DATABASE_URL.
export default {
	schema: "schema.prisma",
	migrations: {
		path: "migrations",
	},
	datasource: {
		url: process.env.DATABASE_URL ?? "file:./rho.sqlite",
	},
};
