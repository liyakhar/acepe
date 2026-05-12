import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/components/header.svelte", async () => ({
	default: (await import("./compare/[slug]/test-fixtures/header-stub.svelte")).default,
}));

const { default: Page } = await import("./+page.svelte");

describe("homepage performance contract", () => {
	it("keeps heavyweight below-fold demos out of the initial server render", () => {
		const { body } = render(Page, {
			props: {
				data: {
					featureFlags: {
						loginEnabled: false,
						downloadEnabled: true,
						roadmapEnabled: false,
					},
					githubStars: null,
				},
			},
		});

		expect(body).toContain("SQL Studio");
		expect(body).toContain("Kanban Board");
	});
});
