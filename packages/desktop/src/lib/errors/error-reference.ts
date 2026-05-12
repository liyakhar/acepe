export interface ErrorReferenceDetails {
	readonly referenceId: string;
	readonly searchable: boolean;
	readonly backendEventId?: string;
}

interface ErrorWithReference extends Error {
	cause?: unknown;
	__acepeReferenceDetails?: ErrorReferenceDetails;
	backendCorrelationId?: unknown;
	backendEventId?: unknown;
}

function extractOwnReferenceDetails(error: ErrorWithReference): ErrorReferenceDetails | null {
	const attached = error.__acepeReferenceDetails;
	if (attached !== undefined) {
		return attached;
	}

	const backendCorrelationId =
		typeof error.backendCorrelationId === "string" ? error.backendCorrelationId : null;
	if (backendCorrelationId === null) {
		return null;
	}

	const backendEventId =
		typeof error.backendEventId === "string" ? error.backendEventId : undefined;
	return {
		referenceId: backendCorrelationId,
		searchable: backendEventId !== undefined,
		backendEventId,
	};
}

export function createLocalReferenceDetails(): ErrorReferenceDetails {
	return {
		referenceId: crypto.randomUUID(),
		searchable: false,
	};
}

/**
 * Build a deterministic, content-derived local reference id from a stable
 * fingerprint string (e.g. `${title}|${details}`). Returns the same id for
 * identical inputs, allowing callers to mint reference ids inside `$derived`
 * without resorting to `$effect` to keep the id stable across reactive reads.
 *
 * Uses a 32-bit FNV-1a hash; collisions are acceptable for support-correlation
 * UX and the value is rendered as an 8-char lowercase hex code prefixed with
 * `local-` to make it visually distinguishable from backend correlation ids.
 */
export function deriveLocalReferenceId(fingerprint: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < fingerprint.length; index += 1) {
		hash ^= fingerprint.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `local-${hash.toString(16).padStart(8, "0")}`;
}

export function attachErrorReference<T extends Error>(error: T, details: ErrorReferenceDetails): T {
	(error as ErrorWithReference).__acepeReferenceDetails = details;
	return error;
}

export function findErrorReference(error: unknown): ErrorReferenceDetails | null {
	let current: unknown = error;
	let depth = 0;

	while (current instanceof Error && depth < 10) {
		const ownReference = extractOwnReferenceDetails(current as ErrorWithReference);
		if (ownReference !== null) {
			return ownReference;
		}

		current = (current as ErrorWithReference).cause;
		depth += 1;
	}

	return null;
}

export function ensureErrorReference(
	error: Error,
	fallback?: Partial<Pick<ErrorReferenceDetails, "searchable" | "backendEventId">>
): ErrorReferenceDetails {
	const existingReference = findErrorReference(error);
	if (existingReference !== null) {
		return existingReference;
	}

	const errorWithReference = attachErrorReference(error, {
		referenceId: crypto.randomUUID(),
		searchable: fallback?.searchable === true,
		backendEventId: fallback?.backendEventId,
	}) as ErrorWithReference;

	return errorWithReference.__acepeReferenceDetails as ErrorReferenceDetails;
}
