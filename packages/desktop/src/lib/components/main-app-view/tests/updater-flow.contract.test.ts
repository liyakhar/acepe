import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const mainAppViewPath = resolve(process.cwd(), "src/lib/components/main-app-view.svelte");

describe("updater flow contract", () => {
	it("splits startup and polling update checks into separate flows", () => {
		expect(existsSync(mainAppViewPath)).toBe(true);
		if (!existsSync(mainAppViewPath)) return;

		const source = readFileSync(mainAppViewPath, "utf8");

		expect(source).toContain('type UpdateCheckTrigger = "startup" | "polling";');
		expect(source).toContain('await checkForAppUpdate("startup");');
		expect(source).toContain('void checkForAppUpdate("polling");');
		expect(source).toContain("let blockAppForUpdate = $state(false);");
		expect(source).toContain("shouldShowBlockingUpdaterOverlay(updaterState)");
	});

	it("resolves splash visibility before full initialization and startup maximize wiring", () => {
		expect(existsSync(mainAppViewPath)).toBe(true);
		if (!existsSync(mainAppViewPath)) return;

		const source = readFileSync(mainAppViewPath, "utf8");
		const splashResolutionIndex = source.indexOf("const splashResolution = viewState.resolveSplashScreen();");
		const initializeIndex = source.indexOf("const initResult = await viewState.initialize();");
		const attemptIndex = source.indexOf("attemptStartupMaximize();");

		expect(splashResolutionIndex).toBeGreaterThan(-1);
		expect(initializeIndex).toBeGreaterThan(-1);
		expect(attemptIndex).toBeGreaterThan(-1);
		expect(splashResolutionIndex).toBeLessThan(initializeIndex);
		expect(source).toContain("canMaximizeFromStartupGate(viewState.showSplash, updaterState)");
	});
});
