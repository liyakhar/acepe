import { okAsync, type ResultAsync } from "neverthrow";
import type { SessionDomainEvent } from "../../../services/acp-types.js";
import { LOGGER_IDS } from "../../constants/logger-ids.js";
import type { AppError } from "../../errors/app-error.js";
import type { AcpError } from "../../errors/index.js";
import type { SessionDomainEventSubscriber } from "../../logic/session-domain-event-subscriber.js";
import { createLogger } from "../../utils/logger.js";

interface OperationProjectionHydrator {
	hydrateSession(sessionId: string): ResultAsync<void, AppError>;
}

type DomainEventSubscriberLike = Pick<
	SessionDomainEventSubscriber,
	"subscribe" | "unsubscribeById"
>;

function shouldRefreshProjection(event: SessionDomainEvent): boolean {
	return (
		event.kind === "operation_upserted" ||
		event.kind === "operation_completed" ||
		event.kind === "operation_child_linked"
	);
}

export class LiveOperationProjectionSync {
	private listenerId: string | null = null;
	private readonly logger = createLogger({
		id: LOGGER_IDS.SESSION_DOMAIN_EVENT_SUBSCRIBER,
		name: "Live Operation Projection Sync",
	});

	constructor(
		private readonly subscriber: DomainEventSubscriberLike,
		private readonly hydrator: OperationProjectionHydrator
	) {}

	start(): ResultAsync<void, AcpError> {
		if (this.listenerId !== null) {
			return okAsync(undefined);
		}

		return this.subscriber
			.subscribe((event) => {
				if (!shouldRefreshProjection(event)) {
					return;
				}

				void this.hydrator.hydrateSession(event.session_id).match(
					() => {},
					(error) => {
						this.logger.error("Failed to hydrate operation projection from domain event", {
							sessionId: event.session_id,
							kind: event.kind,
							error,
						});
					}
				);
			})
			.map((listenerId) => {
				this.listenerId = listenerId;
				return undefined;
			});
	}

	stop(): void {
		if (this.listenerId === null) {
			return;
		}

		this.subscriber.unsubscribeById(this.listenerId);
		this.listenerId = null;
	}
}
