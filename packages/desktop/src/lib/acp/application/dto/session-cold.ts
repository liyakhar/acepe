import type { SessionIdentity } from "./session-identity.js";
import type { SessionMetadata } from "./session-metadata.js";

/**
 * Session cold data - serializable to database.
 *
 * Combines immutable session facts with persisted metadata. Existing-session
 * reconnect still routes through backend descriptor resolution rather than
 * trusting these fields as frontend resume authority.
 */
export interface SessionCold extends SessionIdentity, SessionMetadata {}
