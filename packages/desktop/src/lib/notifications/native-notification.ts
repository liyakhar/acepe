import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";

export interface NativeNotificationPayload {
	readonly title: string;
	readonly body: string;
}

export function getNotificationPermission(): Promise<boolean> {
	return isPermissionGranted();
}

export function requestNotificationPermission(): Promise<"default" | "denied" | "granted"> {
	return requestPermission();
}

export function sendNativeNotification(payload: NativeNotificationPayload): void {
	sendNotification(payload);
}
