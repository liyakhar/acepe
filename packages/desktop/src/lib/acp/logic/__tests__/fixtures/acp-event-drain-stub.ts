type DrainScheduler = (callback: () => void) => void;

type DrainOptions = {
	readonly maxBatchSize?: number;
	readonly maxBatchMs?: number;
	readonly now?: () => number;
	readonly schedule?: DrainScheduler;
};

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_BATCH_MS = 8;

export function createTestAcpEventDrain<TEnvelope>(
	onEnvelope: (envelope: TEnvelope) => void,
	options: DrainOptions = {}
): (envelope: TEnvelope) => void {
	const queue: TEnvelope[] = [];
	const maxBatchSize = options.maxBatchSize ?? DEFAULT_BATCH_SIZE;
	const maxBatchMs = options.maxBatchMs ?? DEFAULT_BATCH_MS;
	const now = options.now ?? (() => performance.now());
	const schedule = options.schedule ?? ((callback: () => void) => setTimeout(callback, 0));
	let scheduled = false;

	const drain = () => {
		scheduled = false;
		const startedAt = now();
		let processed = 0;

		while (queue.length > 0) {
			const nextEnvelope = queue.shift();
			if (nextEnvelope === undefined) {
				break;
			}

			onEnvelope(nextEnvelope);
			processed += 1;

			if (processed >= maxBatchSize || now() - startedAt >= maxBatchMs) {
				break;
			}
		}

		if (queue.length > 0 && !scheduled) {
			scheduled = true;
			schedule(drain);
		}
	};

	return (envelope) => {
		queue.push(envelope);
		if (scheduled) {
			return;
		}
		scheduled = true;
		schedule(drain);
	};
}
