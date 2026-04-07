import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const welcomeScreenPath = resolve(
	import.meta.dir,
	"./lib/acp/components/welcome-screen/welcome-screen.svelte"
);
const openProjectDialogPath = resolve(
	import.meta.dir,
	"./lib/acp/components/add-repository/open-project-dialog.svelte"
);
const actionsCellPath = resolve(
	import.meta.dir,
	"./lib/acp/components/add-repository/cells/actions-cell.svelte"
);
const projectDiscoveryPath = resolve(
	import.meta.dir,
	"./lib/acp/components/add-repository/project-discovery.ts"
);
const tauriTypesPath = resolve(import.meta.dir, "./lib/utils/tauri-client/types.ts");
const rustProjectsCommandPath = resolve(
	import.meta.dir,
	"../src-tauri/src/history/commands/projects.rs"
);
const rustHistoryModPath = resolve(
	import.meta.dir,
	"../src-tauri/src/history/commands/mod.rs"
);

const welcomeScreenSource = readFileSync(welcomeScreenPath, "utf8");
const openProjectDialogSource = readFileSync(openProjectDialogPath, "utf8");
const actionsCellSource = readFileSync(actionsCellPath, "utf8");
const projectDiscoverySource = readFileSync(projectDiscoveryPath, "utf8");
const tauriTypesSource = readFileSync(tauriTypesPath, "utf8");
const rustProjectsCommandSource = readFileSync(rustProjectsCommandPath, "utf8");
const rustHistoryModSource = readFileSync(rustHistoryModPath, "utf8");

describe("onboarding projects step contract", () => {
	it("keeps the onboarding projects card within the window and scrolls its list", () => {
		expect(welcomeScreenSource).toContain("max-h-[min(");
		expect(welcomeScreenSource).toContain("overflow-hidden");
		expect(welcomeScreenSource).toContain("p-5");
	});

	it("filters worktrees out of onboarding and add-project discovery lists", () => {
		expect(welcomeScreenSource).toContain("shouldShowDiscoveredProject");
		expect(openProjectDialogSource).toContain("shouldShowDiscoveredProject");
		expect(projectDiscoverySource).toContain("!info.is_worktree");
		expect(projectDiscoverySource).toContain("/.acepe/worktrees/");
		expect(tauriTypesSource).toContain("is_worktree: boolean");
		expect(rustHistoryModSource).toContain("pub is_worktree: bool");
		expect(rustProjectsCommandSource).toContain("is_worktree: is_worktree_project_path");
	});

	it("uses header-action buttons for project import actions", () => {
		expect(actionsCellSource).toContain('import { Button } from "@acepe/ui/button";');
		expect(actionsCellSource).toContain('variant="headerAction"');
		expect(actionsCellSource).toContain('size="headerAction"');
		expect(actionsCellSource).not.toContain("PillButton");
	});

	it("uses the shared header-action shell for the projects finish button", () => {
		expect(welcomeScreenSource).not.toContain(
			'<PillButton variant="primary" onclick={() => finishOnboarding()}>'
		);
		expect(welcomeScreenSource).toMatch(
			/<Button[\s\S]*variant="headerAction"[\s\S]*size="headerAction"[\s\S]*onclick=\{\(\) => finishOnboarding\(\)\}[\s\S]*\{m\.welcome_finish\(\)\}/
		);
		expect(welcomeScreenSource).toContain('class="h-9 rounded-none border-0 bg-transparent px-3 text-sm shadow-none"');
	});

	it("uses the shared header-action shell for the projects back button", () => {
		expect(welcomeScreenSource).not.toContain(
			'<PillButton variant="outline" onclick={() => (onboardingStep = "agents")}>'
		);
		expect(welcomeScreenSource).toMatch(
			/<Button[\s\S]*variant="headerAction"[\s\S]*size="headerAction"[\s\S]*onclick=\{\(\) => \(onboardingStep = "agents"\)\}[\s\S]*\{m\.common_back\(\)\}/
		);
		expect(welcomeScreenSource).toContain('class="h-9 rounded-none border-0 bg-transparent px-3 text-sm shadow-none"');
	});

	it("starts the onboarding agent step with no preselected agents", () => {
		expect(welcomeScreenSource).toContain("return [];");
		expect(welcomeScreenSource).not.toContain("return agentStore.agents.map((agent) => agent.id);");
	});

	it("removes the projects-step header and subheader copy", () => {
		expect(welcomeScreenSource).toContain('{#if onboardingStep !== "projects"}');
		expect(welcomeScreenSource).not.toContain("{m.welcome_onboarding_select_projects()}");
		expect(welcomeScreenSource).not.toContain(
			"{m.welcome_onboarding_select_projects_description()}"
		);
	});
});
