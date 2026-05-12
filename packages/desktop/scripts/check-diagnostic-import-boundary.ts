#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";

const DESKTOP_ROOT = join(import.meta.dir, "..");
const SOURCE_ROOT = join(DESKTOP_ROOT, "src", "lib");
const SOURCE_EXTENSIONS = new Set([".ts", ".svelte"]);
const DIAGNOSTIC_FILE_PATTERNS = [
	"src/lib/acp/utils/hot-path-diagnostics.ts",
	"src/lib/acp/components/debug-panel.svelte",
];
const DIAGNOSTIC_DIRECTORY_PATTERNS = ["src/lib/acp/components/debug-panel/"];
const FORBIDDEN_TARGET_DIRECTORIES = ["src/lib/acp/store"];
const FROM_IMPORT_PATTERN =
	/(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:(?!\n\s*(?:import|export)\b)[\s\S])*?\sfrom\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_PATTERN = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*["']([^"']+)["']\s*\)/g;

export type Violation = {
	filePath: string;
	importPath: string;
	resolvedTarget: string;
};

function walkFiles(root: string): string[] {
	const entries = readdirSync(root);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(root, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...walkFiles(fullPath));
			continue;
		}

		if (SOURCE_EXTENSIONS.has(extname(fullPath))) {
			files.push(fullPath);
		}
	}

	return files;
}

function isTestFile(relativePath: string): boolean {
	return (
		relativePath.includes("/__tests__/") ||
		relativePath.endsWith(".test.ts") ||
		relativePath.endsWith(".vitest.ts")
	);
}

export function isDiagnosticFile(relativePath: string): boolean {
	if (DIAGNOSTIC_FILE_PATTERNS.includes(relativePath)) {
		return true;
	}

	return DIAGNOSTIC_DIRECTORY_PATTERNS.some((prefix) => relativePath.startsWith(prefix));
}

export function extractImportPaths(contents: string): string[] {
	const matches: Array<{ index: number; importPath: string }> = [];

	for (const pattern of [FROM_IMPORT_PATTERN, SIDE_EFFECT_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN]) {
		for (const match of contents.matchAll(pattern)) {
			const importPath = match[1];
			if (importPath) {
				matches.push({ index: match.index ?? 0, importPath });
			}
		}
	}

	matches.sort((left, right) => left.index - right.index);
	return matches.map((match) => match.importPath);
}

export function resolveImportTarget(relativeFilePath: string, importPath: string): string | null {
	if (importPath.startsWith("$lib/")) {
		return normalize(join("src", "lib", importPath.slice("$lib/".length)));
	}

	if (importPath.startsWith(".")) {
		return normalize(join(dirname(relativeFilePath), importPath));
	}

	return null;
}

export function violatesBoundary(resolvedTarget: string): boolean {
	return FORBIDDEN_TARGET_DIRECTORIES.some(
		(directory) => resolvedTarget === directory || resolvedTarget.startsWith(`${directory}/`)
	);
}

export function collectViolations(relativePath: string, contents: string): Violation[] {
	if (!isDiagnosticFile(relativePath) || isTestFile(relativePath)) {
		return [];
	}

	const violations: Violation[] = [];

	for (const importPath of extractImportPaths(contents)) {
		const resolvedTarget = resolveImportTarget(relativePath, importPath);
		if (resolvedTarget === null || !violatesBoundary(resolvedTarget)) {
			continue;
		}

		violations.push({
			filePath: relativePath,
			importPath,
			resolvedTarget,
		});
	}

	return violations;
}

function main(): void {
	const violations: Violation[] = [];

	for (const absolutePath of walkFiles(SOURCE_ROOT)) {
		const relativePath = normalize(relative(DESKTOP_ROOT, absolutePath));
		const contents = readFileSync(absolutePath, "utf8");
		for (const violation of collectViolations(relativePath, contents)) {
			violations.push(violation);
		}
	}

	if (violations.length === 0) {
		console.log("No diagnostic import-boundary violations found.");
		return;
	}

	console.error("Diagnostics modules must not import ACP product-store code:");
	for (const violation of violations) {
		console.error(
			`- ${violation.filePath}: ${violation.importPath} -> ${violation.resolvedTarget}`
		);
	}
	console.error(
		"\nMove the dependency behind DTOs/helpers outside src/lib/acp/store/ or keep the logic outside diagnostics/debug modules."
	);
	process.exit(1);
}

if (import.meta.main) {
	main();
}
