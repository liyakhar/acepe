/**
 * Mock for @tabler/icons-svelte to avoid ESM resolution issues in Bun test.
 * The package has internal ./icons-list imports that fail under Bun's module resolver.
 * mock.module() must run before any import of @tabler/icons-svelte (hence preload).
 */
import { mock } from "bun:test";

const mockIcon = () => null;
mock.module("@tabler/icons-svelte", () => ({
	default: mockIcon,
	IconAdjustments: mockIcon,
	IconAlertCircle: mockIcon,
	IconAlertTriangle: mockIcon,
	IconAlignJustified: mockIcon,
	IconArrowDown: mockIcon,
	IconArrowLeft: mockIcon,
	IconArrowRight: mockIcon,
	IconArrowUp: mockIcon,
	IconBrandGoogle: mockIcon,
	IconCheck: mockIcon,
	IconChevronDown: mockIcon,
	IconChevronLeft: mockIcon,
	IconChevronRight: mockIcon,
	IconChevronsLeft: mockIcon,
	IconChevronsRight: mockIcon,
	IconCircle: mockIcon,
	IconCircleCheckFilled: mockIcon,
	IconClock: mockIcon,
	IconCode: mockIcon,
	IconColumns: mockIcon,
	IconCopy: mockIcon,
	IconDots: mockIcon,
	IconDotsVertical: mockIcon,
	IconExternalLink: mockIcon,
	IconEye: mockIcon,
	IconEyeOff: mockIcon,
	IconFile: mockIcon,
	IconFilePlus: mockIcon,
	IconFolder: mockIcon,
	IconHelpCircleFilled: mockIcon,
	IconListTree: mockIcon,
	IconMaximize: mockIcon,
	IconMoon: mockIcon,
	IconPackage: mockIcon,
	IconPencil: mockIcon,
	IconPlus: mockIcon,
	IconRefresh: mockIcon,
	IconRotateClockwise: mockIcon,
	IconSearch: mockIcon,
	IconSelector: mockIcon,
	IconSend: mockIcon,
	IconSparkles: mockIcon,
	IconSquare: mockIcon,
	IconStar: mockIcon,
	IconSun: mockIcon,
	IconTable: mockIcon,
	IconTerminal: mockIcon,
	IconTerminal2: mockIcon,
	IconTrash: mockIcon,
	IconX: mockIcon,
}));

const noop = () => {};
const mockPrimitive = new Proxy(
	{},
	{
		get: () => mockIcon,
	}
);

mock.module("svelte-sonner", () => ({
	Toaster: mockIcon,
	toast: {
		success: noop,
		error: noop,
		info: noop,
		warning: noop,
	},
}));

mock.module("vaul-svelte", () => ({
	Drawer: mockPrimitive,
}));

mock.module("@pierre/diffs/worker/worker.js?worker&url", () => ({
	default: "/mock-pierre-worker.js",
}));
