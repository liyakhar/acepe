import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const kanbanViewPath = resolve(
	process.cwd(),
	"src/lib/components/main-app-view/components/content/kanban-view.svelte"
);

describe("kanban empty-column contract", () => {
	it("builds groups from a fixed section order instead of only queueStore.sections", () => {
		expect(existsSync(kanbanViewPath)).toBe(true);
		if (!existsSync(kanbanViewPath)) return;

		const source = readFileSync(kanbanViewPath, "utf8");

		expect(source).toContain("const SECTION_ORDER: readonly QueueSectionId[] = [");
		expect(source).toContain(
			'const SECTION_ORDER: readonly QueueSectionId[] = [\n\t\t"answer_needed",\n\t\t"planning",\n\t\t"working",\n\t\t"finished",\n\t];'
		);
		expect(source).toContain("SECTION_ORDER.map((sectionId) => {");
		expect(source).toContain(
			"const section = queueStore.sections.find((section) => section.id === sectionId);"
		);
		expect(source).toContain("items: section ? section.items.map(mapItemToCard) : [],");
	});

	it("fills the available content width instead of sizing to its intrinsic content", () => {
		expect(existsSync(kanbanViewPath)).toBe(true);
		if (!existsSync(kanbanViewPath)) return;

		const source = readFileSync(kanbanViewPath, "utf8");

		expect(source).toContain('class="flex h-full min-h-0 min-w-0 flex-1 flex-col"');
		expect(source).toContain('class="min-h-0 min-w-0 flex-1"');
	});
});