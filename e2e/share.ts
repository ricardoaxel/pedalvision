import { deflateSync, strToU8 } from "fflate";

export interface ShareFixture {
	name?: string;
	boards: Array<{
		uid: string;
		boardRefId: string | null;
		customSize?: { widthCm: number; heightCm: number };
		texture?: "matte" | "brushed" | "wood" | "tolex";
		name?: string;
		brand?: string;
		x: number;
		y: number;
		rotationDeg: number;
	}>;
	items: Array<{
		uid: string;
		refId: string;
		kind: "pedal" | "supply";
		boardUid: string | null;
		x: number;
		y: number;
		rotationDeg: number;
		z: number;
	}>;
	customPedals?: unknown[];
	endpoints?: Array<{
		uid: string;
		kind: "amp" | "instrument";
		x: number;
		y: number;
	}>;
	cables?: Array<{
		uid: string;
		from: { itemUid: string; jack: string } | { endpointUid: string };
		to: { itemUid: string; jack: string } | { endpointUid: string };
		color?: string;
	}>;
	/** Default 2 (current); pass 1 to build a legacy graph-less link. */
	version?: 1 | 2;
}

/** Build a valid `#s=v2:…` payload without importing app code. */
export function shareHash(fixture: ShareFixture): string {
	const version = fixture.version ?? 2;
	const payload =
		version === 1
			? {
					version: 1,
					name: fixture.name ?? "Shared board",
					boards: fixture.boards,
					items: fixture.items,
					customPedals: fixture.customPedals ?? [],
				}
			: {
					version: 2,
					name: fixture.name ?? "Shared board",
					boards: fixture.boards,
					items: fixture.items,
					customPedals: fixture.customPedals ?? [],
					endpoints: fixture.endpoints ?? [],
					cables: fixture.cables ?? [],
				};
	const compressed = deflateSync(strToU8(JSON.stringify(payload)));
	return `#s=v${version}:${Buffer.from(compressed).toString("base64url")}`;
}

export function board(
	uid: string,
	overrides: Partial<ShareFixture["boards"][number]> = {},
): ShareFixture["boards"][number] {
	return {
		uid,
		boardRefId: "boss-bcb-1000",
		x: 0,
		y: 0,
		rotationDeg: 0,
		...overrides,
	};
}

export function item(
	uid: string,
	overrides: Partial<ShareFixture["items"][number]> = {},
): ShareFixture["items"][number] {
	return {
		uid,
		refId: "boss-bd-2-blues-driver",
		kind: "pedal",
		boardUid: null,
		x: 0,
		y: 0,
		rotationDeg: 0,
		z: 0,
		...overrides,
	};
}
