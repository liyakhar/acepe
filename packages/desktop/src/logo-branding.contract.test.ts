import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

// --- Desktop paths ---
const logoComponentPath = resolve(import.meta.dir, "./lib/components/logo.svelte");
const sidebarHeaderLogoPath = resolve(
	import.meta.dir,
	"./lib/components/sidebar-header-logo.svelte"
);
const translationBrandingPath = resolve(
	import.meta.dir,
	"./lib/i18n/components/translation-branding.svelte"
);
const welcomeScreenPath = resolve(
	import.meta.dir,
	"./lib/acp/components/welcome-screen/welcome-screen.svelte"
);
const updateAvailablePath = resolve(
	import.meta.dir,
	"./lib/components/update-available/update-available-page.svelte"
);
const desktopAppHtmlPath = resolve(import.meta.dir, "../src/app.html");
const tauriConfPath = resolve(import.meta.dir, "../src-tauri/tauri.conf.json");
const androidLauncherBgPath = resolve(
	import.meta.dir,
	"../src-tauri/icons/android/values/ic_launcher_background.xml"
);

// --- Shared asset paths ---
const sharedLogoPath = resolve(import.meta.dir, "../../../assets/logo.svg");
const sharedDarkLogoPath = resolve(import.meta.dir, "../../../assets/logo-dark.svg");
const iconScriptPath = resolve(import.meta.dir, "../scripts/generate-icons.sh");

// --- Website paths ---
const websiteFaviconPath = resolve(import.meta.dir, "../../website/src/lib/assets/favicon.svg");
const websiteLayoutPath = resolve(import.meta.dir, "../../website/src/routes/+layout.svelte");
const websiteLayoutCssPath = resolve(import.meta.dir, "../../website/src/routes/layout.css");
const websiteLogoComponentPath = resolve(
	import.meta.dir,
	"../../website/src/lib/components/logo.svelte"
);
const websiteHeaderPath = resolve(
	import.meta.dir,
	"../../website/src/lib/components/header.svelte"
);
const websiteHomePath = resolve(import.meta.dir, "../../website/src/routes/+page.svelte");
const websiteDownloadPath = resolve(
	import.meta.dir,
	"../../website/src/routes/download/+page.svelte"
);
const websitePricingPath = resolve(
	import.meta.dir,
	"../../website/src/routes/pricing/+page.svelte"
);
const websiteLoginPath = resolve(import.meta.dir, "../../website/src/routes/login/+page.svelte");
const websiteAppHtmlPath = resolve(import.meta.dir, "../../website/src/app.html");
const websiteManifestPath = resolve(import.meta.dir, "../../website/static/site.webmanifest");
const websiteJsonLdPath = resolve(
	import.meta.dir,
	"../../website/src/lib/components/seo/json-ld.svelte"
);

function getEmbeddedPngDimensions(svgSource: string): { width: number; height: number } | null {
	const match = svgSource.match(/data:image\/png;base64,([^\"]+)/);
	if (match === null) {
		return null;
	}

	const pngBuffer = Buffer.from(match[1], "base64");

	return {
		width: pngBuffer.readUInt32BE(16),
		height: pngBuffer.readUInt32BE(20),
	};
}

describe("desktop logo branding", () => {
	it("renders the shared document logo asset instead of the legacy inline mark", () => {
		expect(existsSync(logoComponentPath)).toBe(true);
		expect(existsSync(sharedLogoPath)).toBe(true);
		if (!existsSync(logoComponentPath) || !existsSync(sharedLogoPath)) return;

		const componentSource = readFileSync(logoComponentPath, "utf8");
		const sidebarSource = readFileSync(sidebarHeaderLogoPath, "utf8");
		const assetSource = readFileSync(sharedLogoPath, "utf8");

		expect(componentSource).toContain('import logo from "../../../../../assets/logo.svg?url";');
		expect(componentSource).toContain("<img");
		expect(componentSource).toContain("src={logo}");
		expect(componentSource).not.toContain("<svg");
		expect(sidebarSource).toContain('import Logo from "$lib/components/logo.svelte";');
		expect(sidebarSource).toContain('<Logo class="h-6 w-6" />');
		expect(sidebarSource).not.toContain("Acepe Logo - L4-V2");
		expect(assetSource).toContain('viewBox="0 0 140 140"');
		expect(assetSource).toContain('rx="26"');
		expect(assetSource).toContain("pattern0_62_9");
		expect(assetSource).toContain(
			'transform="matrix(0.0006849315 0 0 0.0006887052 0 0)"'
		);
		expect(assetSource).not.toContain('rx="28"');
		expect(assetSource).not.toContain("pattern0_52_7");
		expect(assetSource).not.toContain("Three bars");
	});

	it("provides a dedicated gold-on-dark logo variant", () => {
		expect(existsSync(sharedDarkLogoPath)).toBe(true);
		if (!existsSync(sharedDarkLogoPath)) return;

		const darkAssetSource = readFileSync(sharedDarkLogoPath, "utf8");

		expect(darkAssetSource).toContain('fill="#1A1A1A"');
		expect(darkAssetSource).toContain('fill="#EBCB8B"');
		expect(darkAssetSource).toContain('mask="url(#mark-mask)"');
		expect(darkAssetSource).toContain("data:image/png;base64,");
		expect(darkAssetSource).not.toContain('fill="url(#pattern0_62_9)"');
	});

	it("all desktop components import the shared logo from assets/", () => {
		const translationSource = readFileSync(translationBrandingPath, "utf8");
		const welcomeSource = readFileSync(welcomeScreenPath, "utf8");
		const updateSource = readFileSync(updateAvailablePath, "utf8");

		// translation-branding and welcome-screen use the primary logo
		expect(translationSource).toContain('assets/logo.svg?url"');
		expect(welcomeSource).toContain('assets/logo.svg?url"');

		// update-available uses the dark variant for the splash screen
		expect(updateSource).toContain('assets/logo-dark.svg?url"');
	});

	it("website uses the branded favicon as a single logo for all themes", () => {
		expect(existsSync(websiteFaviconPath)).toBe(true);
		expect(existsSync(websiteLayoutPath)).toBe(true);
		expect(existsSync(websiteLayoutCssPath)).toBe(true);
		expect(existsSync(websiteLogoComponentPath)).toBe(true);
		if (
			!existsSync(websiteFaviconPath) ||
			!existsSync(websiteLayoutPath) ||
			!existsSync(websiteLayoutCssPath) ||
			!existsSync(websiteLogoComponentPath)
		)
			return;

		const websiteFaviconSource = readFileSync(websiteFaviconPath, "utf8");
		const websiteLayoutSource = readFileSync(websiteLayoutPath, "utf8");
		const websiteLayoutCssSource = readFileSync(websiteLayoutCssPath, "utf8");
		const websiteLogoComponentSource = readFileSync(websiteLogoComponentPath, "utf8");
		const websiteHeaderSource = readFileSync(websiteHeaderPath, "utf8");
		const websiteHomeSource = readFileSync(websiteHomePath, "utf8");
		const websiteDownloadSource = readFileSync(websiteDownloadPath, "utf8");
		const websitePricingSource = readFileSync(websitePricingPath, "utf8");
		const websiteLoginSource = readFileSync(websiteLoginPath, "utf8");

		// The favicon.svg is a copy of the shared source logo
		expect(websiteFaviconSource).toContain('rx="26"');
		expect(websiteFaviconSource).toContain("data:image/png;base64,");

		// Layout dynamically injects the favicon
		expect(websiteLayoutSource).toContain("import logo from '$lib/assets/favicon.svg';");
		expect(websiteLayoutCssSource).toContain("@custom-variant dark (&:is([data-theme='dark'] *));");

		// The Logo component uses the branded favicon.svg, no theme switching
		expect(websiteLogoComponentSource).toContain('import logo from "$lib/assets/favicon.svg"');
		expect(websiteLogoComponentSource).toContain('= "h-8 w-8"');
		expect(websiteLogoComponentSource).not.toContain("dark:hidden");
		expect(websiteLogoComponentSource).not.toContain("dark:block");
		expect(websiteLogoComponentSource).not.toContain("logo-mark");

		// All pages use the centralized Logo component
		for (const pageSource of [websiteHeaderSource, websiteHomeSource, websiteDownloadSource, websitePricingSource, websiteLoginSource]) {
			expect(pageSource).toContain('import Logo from "$lib/components/logo.svelte"');
			expect(pageSource).toContain("<Logo");
		}
	});

	it("tauri.conf.json icon paths match the generated icon filenames", () => {
		expect(existsSync(tauriConfPath)).toBe(true);
		if (!existsSync(tauriConfPath)) return;

		const tauriConf = readFileSync(tauriConfPath, "utf8");

		expect(tauriConf).toContain('"icons/32x32.png"');
		expect(tauriConf).toContain('"icons/128x128.png"');
		expect(tauriConf).toContain('"icons/128x128@2x.png"');
		expect(tauriConf).toContain('"icons/icon.icns"');
		expect(tauriConf).toContain('"icons/icon.ico"');
	});

	it("HTML meta tags reference the correct OG image and favicon assets", () => {
		const desktopHtml = readFileSync(desktopAppHtmlPath, "utf8");
		const websiteHtml = readFileSync(websiteAppHtmlPath, "utf8");

		// Both use .png for OG image (standardized)
		expect(desktopHtml).toContain('content="https://acepe.dev/og-image.png"');
		expect(websiteHtml).toContain('content="https://acepe.dev/og-image.png"');
		expect(desktopHtml).not.toContain("og-image.jpg");
		expect(websiteHtml).not.toContain("og-image.jpg");

		// Desktop uses local favicon.png
		expect(desktopHtml).toContain('href="%sveltekit.assets%/favicon.png"');

		// Website uses apple-touch-icon and PNG favicons (SVG favicon is in +layout.svelte)
		expect(websiteHtml).toContain('href="/apple-touch-icon.png"');
		expect(websiteHtml).toContain('href="/favicon-32x32.png"');
		expect(websiteHtml).toContain('href="/favicon-16x16.png"');
		expect(websiteHtml).toContain('href="/site.webmanifest"');
		// No duplicate static favicon.svg link (managed by +layout.svelte)
		expect(websiteHtml).not.toContain('href="/favicon.svg"');
	});

	it("site.webmanifest references the correct generated favicon filenames", () => {
		expect(existsSync(websiteManifestPath)).toBe(true);
		if (!existsSync(websiteManifestPath)) return;

		const manifest = readFileSync(websiteManifestPath, "utf8");

		expect(manifest).toContain("/favicon.svg");
		expect(manifest).toContain("/favicon-192x192.png");
		expect(manifest).toContain("/favicon-512x512.png");
	});

	it("JSON-LD structured data references the correct image assets", () => {
		expect(existsSync(websiteJsonLdPath)).toBe(true);
		if (!existsSync(websiteJsonLdPath)) return;

		const jsonLd = readFileSync(websiteJsonLdPath, "utf8");

		expect(jsonLd).toContain("https://acepe.dev/favicon-512x512.png");
		expect(jsonLd).toContain("https://acepe.dev/og-image.png");
		expect(jsonLd).not.toContain("og-image.jpg");
	});

	it("Android launcher background matches the brand color", () => {
		expect(existsSync(androidLauncherBgPath)).toBe(true);
		if (!existsSync(androidLauncherBgPath)) return;

		const androidBg = readFileSync(androidLauncherBgPath, "utf8");

		expect(androidBg).toContain("#F1EEE6");
		expect(androidBg).not.toContain("#fff");
	});

	it("uses the shared logo asset as the icon generation source of truth", () => {
		expect(existsSync(iconScriptPath)).toBe(true);
		if (!existsSync(iconScriptPath)) return;

		const scriptSource = readFileSync(iconScriptPath, "utf8");

		expect(scriptSource).toContain('SOURCE_LOGO="$ASSETS_DIR/logo.svg"');
		expect(scriptSource).toContain('magick "$EMBEDDED_PNG"');
		expect(scriptSource).toContain('DARK_LOGO_BACKGROUND="#1A1A1A"');
		expect(scriptSource).toContain('DARK_LOGO_FOREGROUND="#EBCB8B"');
		expect(scriptSource).toContain('LOGO_SOURCE_BACKGROUND="#F1EEE6"');
		expect(scriptSource).toContain('WEBSITE_LOGO_LIGHT_BACKGROUND="#F1EEE6"');
		expect(scriptSource).toContain('cp "$SOURCE_LOGO" "$WEBSITE_STATIC/favicon.svg"');
		expect(scriptSource).toContain('cp "$SOURCE_LOGO" "$WEBSITE_ASSETS/favicon.svg"');
		expect(scriptSource).toContain('base64 < "$LOGO_DARK_MASK_PNG"');
		expect(scriptSource).toContain('"$WEBSITE_STATIC/favicon.ico"');
		expect(scriptSource).toContain('"$WEBSITE_STATIC/og-image.png"');
		expect(scriptSource).toContain('"$WEBSITE_STATIC/og-image.jpg"');
		// No stale patterns
		expect(scriptSource).not.toContain("logo-light-bg.svg");
		expect(scriptSource).not.toContain("logo-mark");
		expect(scriptSource).not.toContain('WEBSITE_LOGO_DARK_FOREGROUND');
		expect(scriptSource).not.toContain('WEBSITE_MARK_');
		expect(scriptSource).not.toContain("resize 280x280");
		expect(scriptSource).not.toContain('cat > "$ASSETS_DIR/logo.svg"');
		expect(scriptSource).not.toContain('cp "$SOURCE_LOGO" "$SOURCE_LOGO_DARK"');
		expect(scriptSource).not.toContain("roundrectangle 100,100 923,923");
		// Header comment has current brand colors
		expect(scriptSource).toContain("#F1EEE6 (cream bg)");
		expect(scriptSource).not.toContain("#f5d0b0");
		expect(scriptSource).not.toContain("#1e1e2e");
	});
});
