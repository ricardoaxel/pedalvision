import type { Jack } from "../catalog/schema";
import {
	type Cable,
	type CableEnd,
	type CustomPedal,
	type Endpoint,
	normalizeCableDirection,
	type PlacedBoard,
	type PlacedItem,
	resolveItem,
	resolveItemJacks,
} from "../state/scene";
import { type CableLengthResult, cableLengthForPoints } from "./cableLength";
import {
	type AnchorIndex,
	buildAnchorIndex,
	cableEndAnchorFromIndex,
	jackIndex,
} from "./jackAnchor";

/**
 * The cable schedule (P4-03, F12): a derived, read-only view of the graph —
 * ordered signal path, per-cable length, totals and the gaps a builder should
 * know about. It never mutates the scene and is never persisted.
 */

export type CableLengthType = "mono" | "trs";

export const CABLE_TYPE_LABEL: Record<CableLengthType, string> = {
	mono: "Mono",
	trs: "TRS",
};

export interface CableScheduleScene {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
}

export interface CableScheduleRow {
	uid: string;
	/** 1-based position along the ordered signal path. */
	order: number;
	fromLabel: string;
	toLabel: string;
	type: CableLengthType;
	/** Either end is the documented fallback jack, not manufacturer data. */
	assumed: boolean;
	/** Which ends are the documented fallback. */
	assumedFrom: boolean;
	assumedTo: boolean;
	/** Either end has an edge-only (invented) jack position. */
	approximate: boolean;
	/** Which ends have an approximate position. */
	approximateFrom: boolean;
	approximateTo: boolean;
	/** Straight-line jack-to-jack distance (world cm). */
	distanceCm: number;
	/** Distance + plug overhang + slack. */
	requiredCm: number;
	/** The next sold length, or null when the run needs a custom length. */
	lengthCm: number | null;
	/** Calculated requirement for a custom length (rounded up to 1 cm). */
	customLengthCm: number | null;
	/** A cable end no longer resolves (defensive; the store normally prunes). */
	unresolved: boolean;
}

export interface CableScheduleTotal {
	type: CableLengthType;
	lengthCm: number | null;
	customLengthCm: number | null;
	count: number;
}

export interface CableSchedule {
	rows: CableScheduleRow[];
	totals: CableScheduleTotal[];
	/** Pedals with no cable at all (supplies are not signal-path parts). */
	unconnectedItems: string[];
	unconnectedEndpoints: string[];
	cableCount: number;
	assumedCount: number;
	unresolvedCount: number;
	customCount: number;
	/** Sum of the lengths to buy (custom runs use their calculated length). */
	totalLengthCm: number;
}

function endpointLabel(kind: Endpoint["kind"]): string {
	return kind === "amp" ? "Amp input" : "Instrument";
}

interface ItemLookup {
	name: string;
	jacks: Jack[];
}

interface SceneLookups {
	items: Map<string, ItemLookup>;
	endpoints: Map<string, Endpoint>;
}

/**
 * Resolve each item's name + effective jacks **once** per schedule build. The
 * per-row path then only does Map lookups — the performance review flagged the
 * old `items.find()` + `resolveItemJacks()` per cable end at the 400/300 cap.
 */
function buildLookups(scene: CableScheduleScene): SceneLookups {
	const items = new Map<string, ItemLookup>();
	for (const item of scene.items) {
		items.set(item.uid, {
			name: resolveItem(item, scene.customPedals).name,
			jacks: resolveItemJacks(item, scene.customPedals),
		});
	}
	return {
		items,
		endpoints: new Map(
			scene.endpoints.map((endpoint) => [endpoint.uid, endpoint]),
		),
	};
}

function endJack(end: CableEnd, lookups: SceneLookups): Jack | undefined {
	if ("endpointUid" in end) return undefined;
	const item = lookups.items.get(end.itemUid);
	if (!item) return undefined;
	const index = jackIndex(end.jack);
	if (index === null) return undefined;
	return item.jacks[index];
}

function endLabel(end: CableEnd, lookups: SceneLookups): string {
	if ("endpointUid" in end) {
		const endpoint = lookups.endpoints.get(end.endpointUid);
		return endpoint ? endpointLabel(endpoint.kind) : "Removed endpoint";
	}
	const item = lookups.items.get(end.itemUid);
	if (!item) return "Removed part";
	const jack = endJack(end, lookups);
	return jack
		? `${item.name} · ${jack.kind.toUpperCase()}`
		: `${item.name} · jack`;
}

function cableTypeOf(
	from: CableEnd,
	to: CableEnd,
	lookups: SceneLookups,
): CableLengthType {
	return endJack(from, lookups)?.stereo === true ||
		endJack(to, lookups)?.stereo === true
		? "trs"
		: "mono";
}

function endNodeKey(end: CableEnd): string {
	return "endpointUid" in end
		? `endpoint:${end.endpointUid}`
		: `item:${end.itemUid}`;
}

interface DirectedCable {
	cable: Cable;
	from: CableEnd;
	to: CableEnd;
	fromKey: string;
	toKey: string;
}

/**
 * Order cables along the signal path: start at instrument endpoints, then at
 * source-only nodes, follow source → sink, and append any remaining branch/loop
 * cables in scene order. Every cable appears exactly once.
 */
function orderCables(
	directed: DirectedCable[],
	scene: CableScheduleScene,
): number[] {
	const outgoing = new Map<string, number[]>();
	const inDegree = new Map<string, number>();
	for (let index = 0; index < directed.length; index++) {
		const edge = directed[index];
		if (!edge) continue;
		const list = outgoing.get(edge.fromKey);
		if (list) list.push(index);
		else outgoing.set(edge.fromKey, [index]);
		inDegree.set(edge.toKey, (inDegree.get(edge.toKey) ?? 0) + 1);
	}

	const visited = new Set<number>();
	const ordered: number[] = [];
	const visit = (node: string) => {
		const list = outgoing.get(node);
		if (!list) return;
		for (const edgeIndex of list) {
			if (visited.has(edgeIndex)) continue;
			visited.add(edgeIndex);
			ordered.push(edgeIndex);
			const edge = directed[edgeIndex];
			if (edge) visit(edge.toKey);
		}
	};

	const starts: string[] = [];
	// The instrument is the semantic source, so it wins the first position.
	for (const endpoint of scene.endpoints) {
		const key = `endpoint:${endpoint.uid}`;
		if (endpoint.kind === "instrument" && outgoing.has(key)) starts.push(key);
	}
	// Then any source-only node (a chain whose instrument was not placed).
	for (const item of scene.items) {
		const key = `item:${item.uid}`;
		if ((inDegree.get(key) ?? 0) === 0 && outgoing.has(key)) starts.push(key);
	}
	for (const endpoint of scene.endpoints) {
		const key = `endpoint:${endpoint.uid}`;
		if ((inDegree.get(key) ?? 0) === 0 && outgoing.has(key)) starts.push(key);
	}
	// Finally, any disconnected component / feedback loop.
	for (const key of outgoing.keys()) starts.push(key);

	for (const key of starts) visit(key);
	// Anything left (a cycle with no entry point) keeps scene order.
	for (let index = 0; index < directed.length; index++) {
		if (!visited.has(index)) ordered.push(index);
	}
	return ordered;
}

/**
 * Build the whole cable schedule for a scene. Pure: the same scene always yields
 * the same rows, totals and flags (no DOM, no store reads).
 */
export function buildCableSchedule(scene: CableScheduleScene): CableSchedule {
	const index: AnchorIndex = buildAnchorIndex(scene);
	const lookups = buildLookups(scene);
	const directed: DirectedCable[] = scene.cables.map((cable) => {
		// Cables are stored source → sink; normalise defensively so a hand-edited
		// document still reads in signal order.
		const direction = normalizeCableDirection(cable.from, cable.to, {
			items: scene.items,
			endpoints: scene.endpoints,
			customPedals: scene.customPedals,
		});
		const from = direction.valid ? direction.from : cable.from;
		const to = direction.valid ? direction.to : cable.to;
		return {
			cable,
			from,
			to,
			fromKey: endNodeKey(from),
			toKey: endNodeKey(to),
		};
	});

	const rows: CableScheduleRow[] = directed.map(({ cable, from, to }) => {
		const fromAnchor = cableEndAnchorFromIndex(from, index);
		const toAnchor = cableEndAnchorFromIndex(to, index);
		const unresolved = !fromAnchor || !toAnchor;
		const length: CableLengthResult | null =
			fromAnchor && toAnchor
				? cableLengthForPoints(fromAnchor.point, toAnchor.point)
				: null;
		return {
			uid: cable.uid,
			order: 0,
			fromLabel: endLabel(from, lookups),
			toLabel: endLabel(to, lookups),
			type: cableTypeOf(from, to, lookups),
			assumed: (fromAnchor?.assumed ?? false) || (toAnchor?.assumed ?? false),
			assumedFrom: fromAnchor?.assumed ?? false,
			assumedTo: toAnchor?.assumed ?? false,
			approximate:
				(fromAnchor?.approximate ?? false) || (toAnchor?.approximate ?? false),
			approximateFrom: fromAnchor?.approximate ?? false,
			approximateTo: toAnchor?.approximate ?? false,
			distanceCm: length?.distanceCm ?? 0,
			requiredCm: length?.requiredCm ?? 0,
			lengthCm: length?.lengthCm ?? null,
			customLengthCm:
				length && length.lengthCm === null
					? Math.ceil(length.requiredCm)
					: null,
			unresolved,
		};
	});

	const order = orderCables(directed, scene);
	const orderedRows = order.map((cableIndex, position) => {
		const row = rows[cableIndex];
		if (!row) throw new Error("cable schedule row is missing");
		return { ...row, order: position + 1 };
	});

	const totalMap = new Map<string, CableScheduleTotal>();
	let totalLengthCm = 0;
	let assumedCount = 0;
	let unresolvedCount = 0;
	let customCount = 0;
	for (const row of orderedRows) {
		if (row.assumed) assumedCount += 1;
		if (row.unresolved) {
			unresolvedCount += 1;
			continue;
		}
		const effective = row.lengthCm ?? row.customLengthCm ?? 0;
		totalLengthCm += effective;
		if (row.lengthCm === null) customCount += 1;
		const key = `${row.type}:${row.lengthCm ?? `custom-${row.customLengthCm}`}`;
		const existing = totalMap.get(key);
		if (existing) {
			existing.count += 1;
		} else {
			totalMap.set(key, {
				type: row.type,
				lengthCm: row.lengthCm,
				customLengthCm: row.customLengthCm,
				count: 1,
			});
		}
	}

	const sortValue = (total: CableScheduleTotal) =>
		total.lengthCm ?? 10_000 + (total.customLengthCm ?? 0);
	const totals = [...totalMap.values()].sort((a, b) => {
		const difference = sortValue(a) - sortValue(b);
		return difference !== 0 ? difference : a.type.localeCompare(b.type);
	});

	const connectedItems = new Set<string>();
	const connectedEndpoints = new Set<string>();
	for (const cable of scene.cables) {
		for (const end of [cable.from, cable.to]) {
			if ("itemUid" in end) connectedItems.add(end.itemUid);
			else connectedEndpoints.add(end.endpointUid);
		}
	}
	const unconnectedItems = scene.items
		.filter((item) => item.kind === "pedal" && !connectedItems.has(item.uid))
		.map((item) => resolveItem(item, scene.customPedals).name);
	const unconnectedEndpoints = scene.endpoints
		.filter((endpoint) => !connectedEndpoints.has(endpoint.uid))
		.map((endpoint) => endpointLabel(endpoint.kind));

	return {
		rows: orderedRows,
		totals,
		unconnectedItems,
		unconnectedEndpoints,
		cableCount: scene.cables.length,
		assumedCount,
		unresolvedCount,
		customCount,
		totalLengthCm,
	};
}
