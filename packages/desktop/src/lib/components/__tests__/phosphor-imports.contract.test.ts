import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(process.cwd(), "src");

function collectSourceFiles(path: string): string[] {
	const entries = readdirSync(path);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(path, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...collectSourceFiles(fullPath));
			continue;
		}

		if (
			fullPath.endsWith(".svelte") ||
			fullPath.endsWith(".ts") ||
			fullPath.endsWith(".js")
		) {
			files.push(fullPath);
		}
	}

	return files;
}

describe("phosphor import contract", () => {
	it("uses root phosphor-svelte imports instead of deep lib imports", () => {
		const offendingFiles = collectSourceFiles(srcRoot).filter((filePath) =>
			filePath !== import.meta.filename &&
			readFileSync(filePath, "utf8").includes('from "phosphor-svelte/lib/')
		);

		expect(offendingFiles).toEqual([]);
	});
});
