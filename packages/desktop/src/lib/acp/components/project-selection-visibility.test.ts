import { describe, expect, it } from "bun:test";
import type { Project } from "$lib/acp/logic/project-manager.svelte.js";

import { getVisibleProjectSelectionProjects } from "./project-selection-visibility.js";

function createProject(path: string, name: string): Project {
	return {
		path,
		name,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		color: "cyan",
	};
}

describe("getVisibleProjectSelectionProjects", () => {
	it("hides missing projects from the picker list", () => {
		const projects = [
			createProject("/projects/alpha", "Alpha"),
			createProject("/projects/missing", "Missing"),
			createProject("/projects/beta", "Beta"),
		];

		const visibleProjects = getVisibleProjectSelectionProjects(
			projects,
			null,
			new Set(["/projects/missing"])
		);

		expect(visibleProjects.map((project) => project.path)).toEqual([
			"/projects/alpha",
			"/projects/beta",
		]);
	});

	it("shows only the preselected project when it is available", () => {
		const projects = [
			createProject("/projects/alpha", "Alpha"),
			createProject("/projects/beta", "Beta"),
		];

		const visibleProjects = getVisibleProjectSelectionProjects(
			projects,
			"/projects/beta",
			new Set<string>()
		);

		expect(visibleProjects.map((project) => project.path)).toEqual(["/projects/beta"]);
	});

	it("falls back to other available projects when the preselected project is missing", () => {
		const projects = [
			createProject("/projects/alpha", "Alpha"),
			createProject("/projects/missing", "Missing"),
			createProject("/projects/beta", "Beta"),
		];

		const visibleProjects = getVisibleProjectSelectionProjects(
			projects,
			"/projects/missing",
			new Set(["/projects/missing"])
		);

		expect(visibleProjects.map((project) => project.path)).toEqual([
			"/projects/alpha",
			"/projects/beta",
		]);
	});
});
