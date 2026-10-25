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

	// No catalog board fits: make a tightly sized custom board instead of
	// splitting the batch across multiple boards.
	const rough = packItems(items, { widthCm: 10_000, heightCm: 10_000 });
	if (!rough) throw new Error("could not lay out the batch");
	const custom = {
		widthCm: Math.ceil(rough.widthCm),
		heightCm: Math.ceil(rough.heightCm),
	};
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

/** Chain each item's first available output to the next item's first input. */
export function chainCables(items: DemoItem[]): DemoCable[] {
	const connectable = items
		.map((item) => {
			const jacks = item.jacks ?? [];
			return {
				item,
				out: jacks.findIndex((jack) => jack.kind === "out"),
				in: jacks.findIndex((jack) => jack.kind === "in"),
			};
		})
		.filter((entry) => entry.out >= 0 && entry.in >= 0);

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
	return cables;
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
