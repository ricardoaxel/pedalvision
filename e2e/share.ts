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
}

/** Build a valid `#s=v1:…` payload without importing app code. */
export function shareHash(fixture: ShareFixture): string {
	const payload = {
		version: 1,
		name: fixture.name ?? "Shared board",
		boards: fixture.boards,
		items: fixture.items,
		customPedals: fixture.customPedals ?? [],
	};
	const compressed = deflateSync(strToU8(JSON.stringify(payload)));
	return `#s=v1:${Buffer.from(compressed).toString("base64url")}`;
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
