import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

export default {
	schema: "./src/lib/server/db/schema.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
} satisfies Config;
