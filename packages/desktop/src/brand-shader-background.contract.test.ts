import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

function read(relativePath: string): string {
	return readFileSync(resolve(import.meta.dir, relativePath), "utf8");
}

describe("shared brand shader background contract", () => {
	it("exports the shared brand shader background and dark palette from the UI package", () => {
		const uiIndexSource = read("../../ui/src/index.ts");
		const packageJsonSource = read("../../ui/package.json");

		expect(uiIndexSource).toContain("BrandShaderBackground");
		expect(uiIndexSource).toContain("BRAND_SHADER_DARK_PALETTE");
		expect(packageJsonSource).toContain("@paper-design/shaders");
	});

	it("routes branded splash surfaces through the shared background component", () => {
		const welcomeSource = read("./lib/acp/components/welcome-screen/welcome-screen.svelte");
		const updateAvailableSource = read("./lib/components/update-available/update-available-page.svelte");
		const updateModalSource = read("./lib/components/update-modal/update-modal.svelte");
		const connectionErrorSource = read(
			"./lib/acp/components/agent-panel/components/connection-error-ui.svelte"
		);
		const animatedBackgroundSource = read("./lib/components/animated-background.svelte");

		for (const source of [
			welcomeSource,
			updateAvailableSource,
			updateModalSource,
			connectionErrorSource,
			animatedBackgroundSource,
		]) {
			expect(source).toContain("BrandShaderBackground");
			expect(source).not.toContain("ShaderMount");
			expect(source).not.toContain("u_colors:");
		}
	});

	it("keeps the auth layout scoped to the existing right-hand brand pane", () => {
		const authLayoutSource = read("./routes/auth/+layout.svelte");

		expect(authLayoutSource).toContain("<AnimatedBackground");
		expect(authLayoutSource).toContain("hidden h-full overflow-hidden lg:flex");
		expect(authLayoutSource).not.toContain("<BrandShaderBackground");
	});

	it("sources changelog dark palette values from the shared brand palette", () => {
		const changelogSource = read("./lib/components/changelog-modal/changelog-modal.svelte");

		expect(changelogSource).toContain("BRAND_SHADER_DARK_PALETTE");
		expect(changelogSource).not.toContain('shaderColors: ["#F77E2C", "#ff8558", "#d69d5c", "#ffb380"]');
	});

	it("adds the shared shader dependency to the UI workspace and lockfile selectors", () => {
		const workspaceContractSource = read("./workspace-dependency-alignment.contract.test.ts");

		expect(workspaceContractSource).toContain('uiPackageJson.dependencies?.["@paper-design/shaders"]');
		expect(workspaceContractSource).toContain('"@paper-design/shaders":');
	});

	it("keeps the shared primitive source file present", () => {
		const componentPath = resolve(
			import.meta.dir,
			"../../ui/src/components/brand-shader-background/brand-shader-background.svelte"
		);
		const palettePath = resolve(import.meta.dir, "../../ui/src/lib/brand-shader-palette.ts");
		const componentSource = readFileSync(componentPath, "utf8");

		expect(existsSync(componentPath)).toBe(true);
		expect(existsSync(palettePath)).toBe(true);
		expect(componentSource).toContain("shaderReady");
		expect(componentSource).toContain("shaderInitVersion");
		expect(componentSource).toContain("initVersion !== shaderInitVersion");
	});
});
