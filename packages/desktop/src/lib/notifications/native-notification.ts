import { tauriClient } from "$lib/utils/tauri-client.js";
import type { ResultAsync } from "neverthrow";
import type { AppError } from "$lib/acp/errors/app-error.js";

export interface NativeNotificationPayload {
	readonly title: string;
	readonly body: string;
}

export async function getNotificationPermission(): Promise<boolean> {
	return tauriClient.notifications.getPermission().match(
		(permissionGranted) => permissionGranted ?? false,
		(error) => {
			throw error;
		}
	);
}

export async function requestNotificationPermission(): Promise<"default" | "denied" | "granted"> {
	return tauriClient.notifications.requestPermission().match(
		(permission) => {
			if (permission === "prompt" || permission === "prompt-with-rationale") {
				return "default";
			}
			return permission;
		},
		(error) => {
			throw error;
		}
	);
}

export function sendNativeNotification(
	payload: NativeNotificationPayload
): ResultAsync<void, AppError> {
	return tauriClient.notifications.send(payload);
}
