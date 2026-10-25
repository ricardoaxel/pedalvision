/**
 * Pure layout/cabling helpers for `catalog:demo-link` (P5 batch guardrail,
 * 2026-10-25). The CLI builds a simple demo scene from a batch so every batch
 * PR can include a share link with the items laid out and visibly connected.
 * The connections are illustrative — not a real audio-routing model.
 */

export type DemoBoard = {
	uid: string;
	boardRefId: string | null;
	customSize?: { widthCm: number; heightCm: number };
	texture?: "matte" | "brushed" | "wood" | "tolex";
	name?: string;
	x: number;
	y: number;
	rotationDeg: number;
};

export type DemoPlacedItem = {
	uid: string;
	refId: string;
	kind: "pedal" | "supply";
	boardUid: string | null;
	x: number;
	y: number;
	rotationDeg: number;
	z: number;
};

export type DemoCable = {
	uid: string;
	from: { itemUid: string; jack: string } | { endpointUid: string };
	to: { itemUid: string; jack: string } | { endpointUid: string };
	color?: string;
};

export type DemoSnapshot = {
	boards: DemoBoard[];
	items: DemoPlacedItem[];
	customPedals: unknown[];
	endpoints: unknown[];
	cables: DemoCable[];
};

export type DemoItem = {
	id: string;
	widthCm: number;
	heightCm: number;
	category: "pedal" | "supply";
	jacks?: Array<{ kind: string }>;
};

export type Placement = {
	id: string;
	x: number;
	y: number;
	row: number;
};

export type BoardSize = { widthCm: number; heightCm: number };

export type PackOptions = {
	gapCm?: number;
	marginCm?: number;
};

export type PackResult = {
	placements: Placement[];
	widthCm: number;
	heightCm: number;
};

export function packItems(
	items: DemoItem[],
	board: BoardSize,
	options: PackOptions = {},
): PackResult | null {
	const gap = options.gapCm ?? 1.5;
	const margin = options.marginCm ?? 1.5;
	const placements: Placement[] = [];
	let cursorX = margin;
	let cursorY = margin;
	let row = 0;
	let rowHeight = 0;
	let usedWidth = 0;

	for (const item of items) {
		if (item.widthCm + margin * 2 > board.widthCm) return null;
		if (cursorX + item.widthCm + margin > board.widthCm) {
			row += 1;
			cursorX = margin;
			cursorY += rowHeight + gap;
			rowHeight = 0;
		}
		if (cursorY + item.heightCm + margin > board.heightCm) return null;
		placements.push({ id: item.id, x: cursorX, y: cursorY, row });
		cursorX += item.widthCm + gap;
		rowHeight = Math.max(rowHeight, item.heightCm);
		usedWidth = Math.max(usedWidth, cursorX - gap + margin);
	}

	return {
		placements,
		widthCm: Math.max(usedWidth, margin * 2),
		heightCm: cursorY + rowHeight + margin,
	};
}

const MAX_CUSTOM_BOARD_CM = 200;
const CUSTOM_PACK_WIDTH_CM = 100;

/** Choose the smallest catalog board that fits; fall back to a custom board. */
export function chooseBoard(
	items: DemoItem[],
	boards: Array<{ id: string } & BoardSize>,
	requestedId?: string,
): {
	board: { boardRefId: string | null; widthCm: number; heightCm: number };
	pack: PackResult;
} {
	if (requestedId) {
		const requested = boards.find((board) => board.id === requestedId);
		if (!requested) throw new Error(`unknown board "${requestedId}"`);
		const pack = packItems(items, requested);
		if (!pack) throw new Error(`items do not fit on board "${requestedId}"`);
		return {
			board: {
				boardRefId: requested.id,
				widthCm: requested.widthCm,
				heightCm: requested.heightCm,
			},
			pack,
		};
	}

	const candidates = [...boards].sort(
		(a, b) => a.widthCm * a.heightCm - b.widthCm * b.heightCm,
	);
	for (const candidate of candidates) {
		const pack = packItems(items, candidate);
		if (pack) {
			return {
				board: {
					boardRefId: candidate.id,
					widthCm: candidate.widthCm,
					heightCm: candidate.heightCm,
				},
				pack,
			};
		}
	}

	// No catalog board fits: wrap at a sensible width, then use a custom board.
	// The share codec rejects custom boards over 200 cm on either axis, so fail
	// clearly instead of emitting an unopenable link.
	const rough = packItems(items, {
		widthCm: CUSTOM_PACK_WIDTH_CM,
		heightCm: 10_000,
	});
	if (!rough) throw new Error("could not lay out the batch");
	const custom = {
		widthCm: Math.ceil(rough.widthCm),
		heightCm: Math.ceil(rough.heightCm),
	};
	if (
		custom.widthCm > MAX_CUSTOM_BOARD_CM ||
		custom.heightCm > MAX_CUSTOM_BOARD_CM
	) {
		throw new Error(
			`custom demo board ${custom.widthCm}×${custom.heightCm} cm exceeds ${MAX_CUSTOM_BOARD_CM} cm; split the batch`,
		);
	}
	const pack = packItems(items, custom);
	if (!pack) throw new Error("could not lay out the custom board");
	return { board: { boardRefId: null, ...custom }, pack };
}

export function boardSnapshot(
	board: { boardRefId: string | null; widthCm: number; heightCm: number },
	uid = "demo-board-1",
): DemoBoard {
	return board.boardRefId
		? { uid, boardRefId: board.boardRefId, x: 0, y: 0, rotationDeg: 0 }
		: {
				uid,
				boardRefId: null,
				customSize: { widthCm: board.widthCm, heightCm: board.heightCm },
				texture: "matte",
				name: "Batch demo board",
				x: 0,
				y: 0,
				rotationDeg: 0,
			};
}

export function itemSnapshots(
	items: DemoItem[],
	pack: PackResult,
	boardUid = "demo-board-1",
): DemoPlacedItem[] {
	const byId = new Map(
		pack.placements.map((placement) => [placement.id, placement]),
	);
	return items.map((item, index) => {
		const placement = byId.get(item.id);
		if (!placement) throw new Error(`missing placement for ${item.id}`);
		return {
			uid: `demo-item-${item.id}`,
			refId: item.id,
			kind: item.category === "supply" ? "supply" : "pedal",
			boardUid,
			x: placement.x,
			y: placement.y,
			rotationDeg: 0,
			z: index,
		};
	});
}

export type CablePlan = {
	cables: DemoCable[];
	/** Items with no audio in/out (supplies, interfaces, incomplete jacks). */
	unconnected: string[];
};

/**
 * Chain each item's first available output to the next item's first input.
 * Catalog pedals with no jack data use the app's documented fallback pair
 * (IN=0 / OUT=1). Items with connector data but no audio in/out (e.g. MIDI I/O)
 * are reported as unconnected instead of being wired to a non-audio jack.
 */
export function cablePlan(items: DemoItem[]): CablePlan {
	const connectable: Array<{ item: DemoItem; out: number; in: number }> = [];
	const unconnected: string[] = [];
	for (const item of items) {
		const jacks = item.jacks ?? [];
		if (jacks.length === 0 && item.category === "pedal") {
			connectable.push({ item, out: 1, in: 0 });
			continue;
		}
		const out = jacks.findIndex((jack) => jack.kind === "out");
		const input = jacks.findIndex((jack) => jack.kind === "in");
		if (out >= 0 && input >= 0) connectable.push({ item, out, in: input });
		else unconnected.push(item.id);
	}

	const cables: DemoCable[] = [];
	for (let i = 0; i < connectable.length - 1; i++) {
		const from = connectable[i];
		const to = connectable[i + 1];
		if (!from || !to) continue;
		cables.push({
			uid: `demo-cable-${i + 1}`,
			from: { itemUid: `demo-item-${from.item.id}`, jack: String(from.out) },
			to: { itemUid: `demo-item-${to.item.id}`, jack: String(to.in) },
		});
	}
	return { cables, unconnected };
}

export function chainCables(items: DemoItem[]): DemoCable[] {
	return cablePlan(items).cables;
}

/** Place board-batch items in a wrapping row (demo link for board batches). */
export function boardRowSnapshots(
	boards: Array<{ id: string; widthCm: number; heightCm: number }>,
	options: { gapCm?: number; maxRowWidthCm?: number } = {},
): DemoBoard[] {
	const gap = options.gapCm ?? 4;
	const maxWidth = options.maxRowWidthCm ?? 140;
	let x = 0;
	let y = 0;
	let rowHeight = 0;
	return boards.map((board, index) => {
		if (x > 0 && x + board.widthCm > maxWidth) {
			x = 0;
			y += rowHeight + gap;
			rowHeight = 0;
		}
		const placed: DemoBoard = {
			uid: `demo-board-${index + 1}`,
			boardRefId: board.id,
			x,
			y,
			rotationDeg: 0,
		};
		x += board.widthCm + gap;
		rowHeight = Math.max(rowHeight, board.heightCm);
		return placed;
	});
}
