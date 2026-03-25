import { applyDownloadEventToProgress } from "./update-download-progress.js";

export type UpdaterBannerState =
	| { kind: "idle" }
	| { kind: "checking" }
	| { kind: "available"; version: string }
	| { kind: "downloading"; version: string; downloadedBytes: number; totalBytes: number | undefined }
	| { kind: "error"; message: string };

export function createCheckingUpdaterState(): UpdaterBannerState {
	return { kind: "checking" };
}

export function createIdleUpdaterState(): UpdaterBannerState {
	return { kind: "idle" };
}

export function createAvailableUpdaterState(version: string): UpdaterBannerState {
	return { kind: "available", version };
}

export function createErrorUpdaterState(message: string): UpdaterBannerState {
	return { kind: "error", message };
}

export function createDownloadingUpdaterState(version: string): UpdaterBannerState {
	return {
		kind: "downloading",
		version,
		downloadedBytes: 0,
		totalBytes: undefined,
	};
}

export function applyUpdaterDownloadEvent(
	state: UpdaterBannerState,
	event: { event: "Started"; data: { contentLength: number | undefined } } | { event: "Progress"; data: { chunkLength: number } } | { event: "Finished" }
): UpdaterBannerState {
	if (state.kind !== "downloading") {
		return state;
	}

	const next = applyDownloadEventToProgress(
		{
			downloadedBytes: state.downloadedBytes,
			totalBytes: state.totalBytes,
		},
		event
	);

	return {
		kind: "downloading",
		version: state.version,
		downloadedBytes: next.downloadedBytes,
		totalBytes: next.totalBytes,
	};
}

export function getUpdaterStatusLabel(state: UpdaterBannerState): string | null {
	if (state.kind === "checking") {
		return "Checking update...";
	}
	if (state.kind === "downloading") {
		if (state.totalBytes && state.totalBytes > 0) {
			const percent = Math.round((state.downloadedBytes / state.totalBytes) * 100);
			return `Downloading ${percent}%`;
		}
		return "Downloading update...";
	}
	if (state.kind === "error") {
		return "Update check failed";
	}
	return null;
}

export function getUpdaterActionLabel(state: UpdaterBannerState): string | null {
	if (state.kind === "available") {
		return `Update ${state.version}`;
	}
	if (state.kind === "downloading") {
		return `Updating ${state.version}`;
	}
	return null;
}
