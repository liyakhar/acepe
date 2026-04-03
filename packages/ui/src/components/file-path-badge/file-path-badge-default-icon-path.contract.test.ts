import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const permissionFeedItemSource = readFileSync(
	resolve(import.meta.dir, "../attention-queue/permission-feed-item.svelte"),
	"utf8",
);
const designSystemShowcaseSource = readFileSync(
	resolve(import.meta.dir, "../../../../../packages/desktop/src/lib/components/dev/design-system-showcase.svelte"),
	"utf8",
);
const permissionBarSource = readFileSync(
	resolve(import.meta.dir, "../../../../../packages/desktop/src/lib/acp/components/tool-calls/permission-bar.svelte"),
	"utf8",
);

describe("FilePathBadge default icon path contract", () => {
	it("does not require explicit /svgs/icons props at common call sites", () => {
		expect(permissionFeedItemSource).not.toContain('iconBasePath="/svgs/icons"');
		expect(designSystemShowcaseSource).not.toContain('iconBasePath="/svgs/icons"');
		expect(permissionBarSource).not.toContain('iconBasePath="/svgs/icons"');
	});
});