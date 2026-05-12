import { describe, expect, it } from "vitest";

import {
	collectViolations,
	extractImportPaths,
	isDiagnosticFile,
	resolveImportTarget,
	violatesBoundary,
} from "../../../../../scripts/check-diagnostic-import-boundary.js";

describe("check-diagnostic-import-boundary", () => {
	it("extracts from-imports, side-effect imports, and dynamic imports", () => {
		const imports = extractImportPaths(`
			import { createStore } from "$lib/acp/store/session-store";
			import "$lib/acp/store";
			export type { SessionEntry } from "$lib/acp/store/types";
			const loader = import("$lib/acp/store/debug");
		`);

		expect(imports).toEqual([
			"$lib/acp/store/session-store",
			"$lib/acp/store",
			"$lib/acp/store/types",
			"$lib/acp/store/debug",
		]);
	});

	it("flags exact store barrel imports and nested store imports only", () => {
		const barrelTarget = resolveImportTarget(
			"src/lib/acp/utils/hot-path-diagnostics.ts",
			"$lib/acp/store"
		);
		expect(barrelTarget).toBe("src/lib/acp/store");
		if (barrelTarget === null) {
			throw new Error("expected barrel import to resolve");
		}

		const nestedTarget = resolveImportTarget(
			"src/lib/acp/utils/hot-path-diagnostics.ts",
			"$lib/acp/store/session-store"
		);
		expect(nestedTarget).toBe("src/lib/acp/store/session-store");
		if (nestedTarget === null) {
			throw new Error("expected nested import to resolve");
		}

		const unrelatedTarget = resolveImportTarget(
			"src/lib/acp/utils/hot-path-diagnostics.ts",
			"$lib/acp/storefront"
		);
		expect(unrelatedTarget).toBe("src/lib/acp/storefront");
		if (unrelatedTarget === null) {
			throw new Error("expected unrelated import to resolve");
		}

		expect(violatesBoundary(barrelTarget)).toBe(true);
		expect(violatesBoundary(nestedTarget)).toBe(true);
		expect(violatesBoundary(unrelatedTarget)).toBe(false);
	});

	it("checks only diagnostic files and skips diagnostic test files", () => {
		expect(isDiagnosticFile("src/lib/acp/utils/hot-path-diagnostics.ts")).toBe(true);
		expect(isDiagnosticFile("src/lib/acp/components/debug-panel.svelte")).toBe(true);
		expect(isDiagnosticFile("src/lib/acp/components/debug-panel/row.ts")).toBe(true);
		expect(isDiagnosticFile("src/lib/acp/components/panel.svelte")).toBe(false);

		expect(
			collectViolations("src/lib/acp/utils/hot-path-diagnostics.ts", 'import "$lib/acp/store";')
		).toEqual([
			{
				filePath: "src/lib/acp/utils/hot-path-diagnostics.ts",
				importPath: "$lib/acp/store",
				resolvedTarget: "src/lib/acp/store",
			},
		]);

		expect(
			collectViolations(
				"src/lib/acp/components/debug-panel/__tests__/panel.test.ts",
				'import "$lib/acp/store";'
			)
		).toEqual([]);
	});
});
