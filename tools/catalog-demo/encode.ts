import { deflateSync, strToU8 } from "fflate";
import type { DemoSnapshot } from "./layout.ts";

/**
 * Minimal v2 share encoder for the Node CLI (P5 batch guardrail).
 *
 * The app's `src/lib/shareLink.ts` is the source of truth, but its extensionless
 * imports don't resolve under `node --experimental-strip-types`. This mirrors
 * the same v2 payload shape; `encode.test.ts` decodes it with the real app codec
 * so drift is caught by the test suite.
 */

const SHARE_NAME_MAX_LENGTH = 48;

export function encodeDemoHash(name: string, snapshot: DemoSnapshot): string {
	const trimmed = name.trim();
	const payload = {
		version: 2,
		name: (trimmed || "Shared scene").slice(0, SHARE_NAME_MAX_LENGTH),
		boards: snapshot.boards,
		items: snapshot.items,
		customPedals: snapshot.customPedals,
		endpoints: snapshot.endpoints,
		cables: snapshot.cables,
	};
	const json = JSON.stringify(payload);
	const compressed = deflateSync(strToU8(json));
	return `#s=v2:${Buffer.from(compressed).toString("base64url")}`;
}
