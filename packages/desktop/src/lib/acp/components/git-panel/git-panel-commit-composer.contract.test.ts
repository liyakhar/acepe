import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "./git-panel.svelte"), "utf8");

describe("GitPanel commit composer wiring", () => {
	it("passes the mic and stacked-action slots into the shared git layout", () => {
		expect(source).toContain("import MicButton");
		expect(source).toContain("{#snippet commitMicButton()}");
		expect(source).toContain("{#snippet commitComposerActions()}");
		expect(source).toContain("commitActions={commitComposerActions}");
		expect(source).toContain("commitMicButton={commitMicButton}");
	});

	it("docks the selected file preview on the right with an explicit close action", () => {
		expect(source).toContain('class="flex min-h-0 flex-1 overflow-hidden"');
		expect(source).toContain('border-l border-border/30 bg-background');
		expect(source).toContain("closeSelectedChangesPreview");
		expect(source).toContain('title="Close preview"');
	});

	it("auto-selects the first file and supports arrow-key navigation", () => {
		expect(source).toContain("const navigableChangesFiles = $derived([");
		expect(source).toContain("void handleFileSelect(firstFile.file, firstFile.staged)");
		expect(source).toContain("function handleChangesKeyDown(event: KeyboardEvent)");
		expect(source).toContain('event.key !== "ArrowDown" && event.key !== "ArrowUp"');
	});
});
