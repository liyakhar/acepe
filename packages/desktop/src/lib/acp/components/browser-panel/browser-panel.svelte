<script lang="ts">
import { ResultAsync } from "neverthrow";
import { onDestroy, onMount } from "svelte";
import { openUrl } from "@tauri-apps/plugin-opener";
import { browserWebview } from "$lib/utils/tauri-client/browser-webview.js";
import { getZoomService } from "$lib/services/zoom.svelte.js";
	import { resolveBrowserPanelBounds } from "./logic/browser-panel-bounds.js";
	import { createLogger } from "../../utils/logger.js";
	import BrowserPanelHeader from "./browser-panel-header.svelte";
import { observeScrollParents } from "./logic/scroll-sync.js";

const logger = createLogger({ id: "browser-panel", name: "BrowserPanel" });

interface Props {
	panelId: string;
	url: string;
	title: string;
	width: number;
	isFullscreenEmbedded?: boolean;
	isFillContainer?: boolean;
	onClose: () => void;
	onResize: (panelId: string, delta: number) => void;
}

const props: Props = $props();

let webviewAreaRef: HTMLDivElement | undefined = $state(undefined);
let headerContainerRef: HTMLDivElement | undefined = $state(undefined);
let rootContainerRef: HTMLDivElement | undefined = $state(undefined);
let webviewCreated = $state(false);
/** True while browserWebview.open() is in-flight (not yet resolved). */
let openPending = false;
let isDestroyed = false;
let closeRequested = false;
let resizeObserver: ResizeObserver | null = null;
let scrollCleanup: (() => void) | null = null;
let currentUrl = $state(props.url);
let lastSyncedUrl = $state(props.url);

let isDragging = $state(false);
let startX = $state(0);

const widthStyle = $derived(
	props.isFullscreenEmbedded || props.isFillContainer
		? "width: 100%; height: 100%;"
		: `width: ${props.width}px;`
);

const webviewLabel = $derived(`browser-${props.panelId}`);
const zoomService = getZoomService();
const zoomLevel = $derived(zoomService.zoomLevel);

function openInSystemBrowser() {
	openUrl(currentUrl).catch((error) => {
		logger.error("[browser-debug] open external FAILED", { panelId: props.panelId, currentUrl, error });
	});
}

function syncWebviewZoom() {
	if (!webviewCreated) {
		return;
	}

	browserWebview.setZoom(webviewLabel, zoomLevel).match(
		() => {
			logger.info("[browser-debug] syncWebviewZoom", {
				panelId: props.panelId,
				label: webviewLabel,
				zoomLevel,
			});
		},
		(error) =>
			logger.error("[browser-debug] syncWebviewZoom FAILED", {
				panelId: props.panelId,
				label: webviewLabel,
				zoomLevel,
				error,
			})
	);
}

function handleClose() {
	closeRequested = true;
	browserWebview.close(webviewLabel).match(
		() => {
			webviewCreated = false;
		},
		(error) => logger.error("[browser-debug] header close FAILED", { panelId: props.panelId, error })
	);
	props.onClose();
}

function resolveNativeBounds() {
	if (!webviewAreaRef) {
		return ResultAsync.fromPromise(
			Promise.reject(new Error("Browser panel area is unavailable")),
			(error) => new Error(`Failed to resolve browser panel bounds: ${String(error)}`)
		);
	}

	const rect = webviewAreaRef.getBoundingClientRect();
	const rootRect = rootContainerRef ? rootContainerRef.getBoundingClientRect() : null;
	const headerRect = headerContainerRef ? headerContainerRef.getBoundingClientRect() : null;

	return ResultAsync.fromPromise(
		resolveBrowserPanelBounds(rect, {
			getWindowInnerPosition: async () => ({ x: 0, y: 0 }),
			getWebviewPosition: async () => ({ x: 0, y: 0 }),
			getScaleFactor: async () => 1,
			getZoomLevel: () => zoomService.zoomLevel,
		}),
		(error) => new Error(`Failed to resolve browser panel bounds: ${String(error)}`)
	).map((bounds) => {
		logger.info("[browser-debug] resolveNativeBounds", {
			panelId: props.panelId,
			rawRect: {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			},
			rootRect: rootRect
				? {
					x: rootRect.x,
					y: rootRect.y,
					width: rootRect.width,
					height: rootRect.height,
				}
				: null,
			headerRect: headerRect
				? {
					x: headerRect.x,
					y: headerRect.y,
					width: headerRect.width,
					height: headerRect.height,
				}
				: null,
			zoomLevel: zoomService.zoomLevel,
			devicePixelRatio: window.devicePixelRatio,
			visualViewport: window.visualViewport
				? {
					scale: window.visualViewport.scale,
					width: window.visualViewport.width,
					height: window.visualViewport.height,
					offsetLeft: window.visualViewport.offsetLeft,
					offsetTop: window.visualViewport.offsetTop,
				}
				: null,
			windowInnerPosition: { x: 0, y: 0 },
			webviewPosition: { x: 0, y: 0 },
			scaleFactor: 1,
			resolvedBounds: bounds,
		});

		return bounds;
	});
}

function navigateToUrl(nextUrl: string) {
	currentUrl = nextUrl;
	closeRequested = false;
	if (webviewCreated) {
		browserWebview.navigate(webviewLabel, nextUrl).match(
			() => undefined,
			(error) =>
				logger.error("[browser-debug] navigate FAILED", { panelId: props.panelId, nextUrl, error })
		);
	}
}

function createWebview() {
	if (!webviewAreaRef || webviewCreated || openPending || isDestroyed) {
		logger.info("[browser-debug] createWebview skipped", {
			panelId: props.panelId,
			hasRef: !!webviewAreaRef,
			webviewCreated,
			openPending,
			isDestroyed,
		});
		return;
	}

	const label = webviewLabel;
	const requestedUrl = currentUrl;
	openPending = true;
	resolveNativeBounds().andThen((bounds) => {
		logger.info("[browser-debug] createWebview calling open", {
			label,
			url: requestedUrl,
			x: bounds.x,
			y: bounds.y,
			w: bounds.width,
			h: bounds.height,
		});

		return browserWebview.open(
			label,
			requestedUrl,
			bounds.x,
			bounds.y,
			bounds.width,
			bounds.height
		);
	}).match(
		() => {
			openPending = false;
			if (isDestroyed || closeRequested) {
				logger.info("[browser-debug] createWebview: already destroyed, closing", { label });
				browserWebview.close(label);
				webviewCreated = false;
				return;
			}
			webviewCreated = true;
			syncWebviewZoom();
			logger.info("[browser-debug] createWebview success, scheduling re-sync", {
				label,
				url: currentUrl,
			});
			// Re-sync bounds after creation in case a ResizeObserver event
			// fired while webviewCreated was still false (race with async open).
			// Use two frames: first lets flex layout settle, second reads final rect.
			requestAnimationFrame(() => {
				requestAnimationFrame(() => syncWebviewBounds());
			});
			if (currentUrl !== requestedUrl) {
				browserWebview.navigate(label, currentUrl).match(
					() => undefined,
					(error) =>
						logger.error("[browser-debug] post-open navigate FAILED", {
							panelId: props.panelId,
							requestedUrl,
							currentUrl,
							error,
						})
				);
			}
		},
		(error) => {
			openPending = false;
			logger.error("[browser-debug] createWebview FAILED", { label, error });
		}
	);
}

function syncWebviewBounds() {
	if (!webviewAreaRef || !webviewCreated) {
		return;
	}

	resolveNativeBounds().andThen((bounds) => {
		if (bounds.width <= 0 || bounds.height <= 0) {
			return ResultAsync.fromPromise(
				Promise.resolve(undefined),
				() => new Error("Skipped zero-sized browser panel bounds")
			);
		}

		logger.info("[browser-debug] syncWebviewBounds resizing", {
			panelId: props.panelId,
			label: webviewLabel,
			x: bounds.x,
			y: bounds.y,
			w: bounds.width,
			h: bounds.height,
			zoomLevel,
		});

		return browserWebview.resize(
			webviewLabel,
			bounds.x,
			bounds.y,
			bounds.width,
			bounds.height
		);
	}).match(
		() => undefined,
		(error) => logger.error("[browser-debug] syncWebviewBounds FAILED", { panelId: props.panelId, error })
	);
}

function destroyWebview() {
	logger.info("[browser-debug] destroyWebview called", {
		panelId: props.panelId,
		webviewCreated,
		openPending,
		label: webviewLabel,
	});

	const label = webviewLabel;
 	closeRequested = true;

	if (webviewCreated) {
		// Webview is confirmed open — close it immediately.
		browserWebview.close(label).match(
			() => logger.info("[browser-debug] destroyWebview: close success", { label }),
			(error) => logger.error("[browser-debug] destroyWebview: close FAILED", { label, error })
		);
		webviewCreated = false;
	} else if (openPending) {
		// open() is still in-flight.  isDestroyed=true will cause the
		// .match() success handler above to close it once it resolves.
		// As an extra safety net, schedule a deferred close so the
		// native webview is removed even if a subtle timing issue occurs.
		logger.info("[browser-debug] destroyWebview: open pending, scheduling deferred close", {
			label,
		});
		setTimeout(() => {
			browserWebview.close(label).match(
				() => logger.info("[browser-debug] destroyWebview: deferred close success", { label }),
				(error) =>
					logger.info(
						"[browser-debug] destroyWebview: deferred close (expected if already closed)",
						{ label, error: String(error) }
					)
			);
		}, 500);
	} else if (closeRequested) {
		browserWebview.close(label).match(
			() => logger.info("[browser-debug] destroyWebview: best-effort close success", { label }),
			(error) =>
				logger.info("[browser-debug] destroyWebview: best-effort close failed", {
					label,
					error: String(error),
				})
		);
	}
	// If neither webviewCreated nor openPending, nothing was ever opened.
}

function goBack() {
	if (webviewCreated) browserWebview.back(webviewLabel);
}

function goForward() {
	if (webviewCreated) browserWebview.forward(webviewLabel);
}

function reload() {
	if (webviewCreated) browserWebview.reload(webviewLabel);
}

function handlePointerDown(e: PointerEvent) {
	isDragging = true;
	startX = e.clientX;
	(e.target as HTMLElement).setPointerCapture(e.pointerId);
}

function handlePointerMove(e: PointerEvent) {
	if (!isDragging) return;
	const delta = e.clientX - startX;
	startX = e.clientX;
	props.onResize(props.panelId, delta);
}

function handlePointerUp() {
	isDragging = false;
}

onMount(() => {
	// Wait two frames so flex layout settles before reading initial bounds.
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			createWebview();
		});
	});

	if (webviewAreaRef) {
		resizeObserver = new ResizeObserver(() => {
			syncWebviewBounds();
		});
		resizeObserver.observe(webviewAreaRef);
		scrollCleanup = observeScrollParents(webviewAreaRef, () => {
			syncWebviewBounds();
		});
		window.addEventListener("resize", syncWebviewBounds, { passive: true });
	}
});

onDestroy(() => {
	isDestroyed = true;
	resizeObserver?.disconnect();
	scrollCleanup?.();
	window.removeEventListener("resize", syncWebviewBounds);
	destroyWebview();
});

$effect(() => {
	// Track width and layout mode changes to sync webview bounds.
	// Use double-rAF so the layout settles after prop-driven CSS changes.
	props.width;
	props.isFillContainer;
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			syncWebviewBounds();
		});
	});
});

$effect(() => {
	if (props.url !== lastSyncedUrl) {
		lastSyncedUrl = props.url;
		currentUrl = props.url;
	}
});

$effect(() => {
	zoomLevel;
	syncWebviewZoom();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			syncWebviewBounds();
		});
	});
});
</script>

<div
	bind:this={rootContainerRef}
	class="flex flex-col h-full min-h-0 bg-background border border-border overflow-hidden relative {isDragging
		? 'select-none'
		: ''} {props.isFillContainer ? 'flex-1 min-w-0' : 'shrink-0 grow-0'}"
	style={widthStyle}
>
	<div bind:this={headerContainerRef} class="shrink-0">
		<BrowserPanelHeader
			url={currentUrl}
			onBack={goBack}
			onForward={goForward}
			onReload={reload}
			onNavigate={navigateToUrl}
			onOpenExternal={openInSystemBrowser}
			onClose={handleClose}
		/>
	</div>

	<div bind:this={webviewAreaRef} class="flex-1 min-h-0 bg-white"></div>

	{#if !props.isFullscreenEmbedded}
		<div
			class="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-primary/20 active:bg-primary/40 transition-colors"
			role="separator"
			aria-orientation="vertical"
			tabindex="-1"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		></div>
	{/if}
</div>
