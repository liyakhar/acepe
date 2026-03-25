import type { Project } from "$lib/acp/logic/project-manager.svelte.js";

export function getVisibleProjectSelectionProjects(
	projects: Project[],
	preSelectedProjectPath: string | null | undefined,
	missingProjectPaths: ReadonlySet<string>
): Project[] {
	const availableProjects = projects.filter((project) => !missingProjectPaths.has(project.path));

	if (!preSelectedProjectPath) {
		return availableProjects;
	}

	const matchingProject = availableProjects.find(
		(project) => project.path === preSelectedProjectPath
	);

	return matchingProject ? [matchingProject] : availableProjects;
}
