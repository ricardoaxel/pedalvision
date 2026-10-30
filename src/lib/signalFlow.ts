import { isCableJack, type Jack } from "../catalog/schema";
import {
	type Cable,
	type CableEnd,
	type CustomPedal,
	type Endpoint,
	jackIndex,
	type PlacedBoard,
	type PlacedItem,
	type ResolvedJack,
	resolveItem,
	resolveItemJacks,
	usesFallbackJacks,
} from "../state/scene";

/**
 * Signal-flow validation (F-36, "Continuity Check").
 *
 * A pure, derived report over the patch graph. It never mutates the scene, is
 * never persisted, and never blocks an action: the store keeps its hard
 * refusals, while this report only points out what a builder should check.
 * Catalog pedals without jack data expose the documented fallback pair, so a
 * missing catalog fact is disclosed as "assumed" and never becomes an error.
 */

export type SignalIssueCode =
	| "direction-conflict"
	| "instrument-unconnected"
	| "instrument-bad-target"
	| "amp-unconnected"
	| "amp-bad-source"
	| "pedal-missing-input"
	| "pedal-missing-output"
	| "pedal-no-audio-jacks"
	| "dangling-cable-end"
	| "non-audio-cable"
	| "unconnected-pedal"
	| "unconnected-chain"
	| "incomplete-chain"
	| "feedback-loop-direct"
	| "feedback-loop-indirect"
	| "effects-loop"
	| "trs-mono-mismatch";

export type SignalSeverity = "warning" | "info";

export interface SignalIssue {
	code: SignalIssueCode;
	severity: SignalSeverity;
	title: string;
	detail: string;
	itemUids: string[];
	endpointUids: string[];
	cableUids: string[];
	assumed: boolean;
}

export interface SignalFlowScene {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
}

export interface SignalReport {
	issues: SignalIssue[];
	warningCount: number;
	infoCount: number;
	checkedCables: number;
	assumedEndCount: number;
	hasInstrument: boolean;
	hasAmp: boolean;
	endToEnd: boolean;
}

type Role = "source" | "sink" | "neutral";

const SOURCE_KINDS = new Set<string>(["out", "send", "exp-out"]);
const SINK_KINDS = new Set<string>(["in", "return", "exp-in"]);

interface ItemInfo {
	uid: string;
	item: PlacedItem;
	name: string;
	jacks: ResolvedJack[];
	assumed: boolean;
	audioJacks: Array<{ index: number; jack: ResolvedJack }>;
}

type EndInfo =
	| {
			kind: "item";
			uid: string;
			item: ItemInfo;
			jack: ResolvedJack;
			jackIndex: number;
	  }
	| { kind: "endpoint"; uid: string; endpoint: Endpoint };

interface DirectedCable {
	cable: Cable;
	from: EndInfo;
	to: EndInfo;
	fromRole: Role;
	toRole: Role;
	assumed: boolean;
}

interface FeedbackEdge {
	from: string;
	to: string;
	sourceKind: Jack["kind"];
	sinkKind: Jack["kind"];
	cableUid: string;
	assumed: boolean;
}

function roleOfJack(kind: Jack["kind"]): Role {
	if (SOURCE_KINDS.has(kind)) return "source";
	if (SINK_KINDS.has(kind)) return "sink";
	return "neutral";
}

function roleOfEnd(end: EndInfo): Role {
	if (end.kind === "endpoint") {
		return end.endpoint.kind === "instrument" ? "source" : "sink";
	}
	return roleOfJack(end.jack.kind);
}

function isAudioEnd(end: EndInfo): boolean {
	return end.kind === "endpoint" || isCableJack(end.jack.kind);
}

function endAssumed(end: EndInfo): boolean {
	if (end.kind === "endpoint") return false;
	return end.item.assumed || end.jack.approximate === true;
}

function buildItemInfo(
	item: PlacedItem,
	customPedals: CustomPedal[],
): ItemInfo {
	const resolved = resolveItem(item, customPedals);
	const jacks = resolveItemJacks(item, customPedals);
	const audioJacks = jacks.flatMap((jack, index) =>
		isCableJack(jack.kind) ? [{ index, jack }] : [],
	);
	return {
		uid: item.uid,
		item,
		name: resolved.name,
		jacks,
		assumed: usesFallbackJacks(item, customPedals),
		audioJacks,
	};
}

function resolveEnd(
	end: CableEnd,
	items: Map<string, ItemInfo>,
	endpoints: Map<string, Endpoint>,
): EndInfo | null {
	if ("endpointUid" in end) {
		const endpoint = endpoints.get(end.endpointUid);
		return endpoint ? { kind: "endpoint", uid: endpoint.uid, endpoint } : null;
	}
	const item = items.get(end.itemUid);
	const index = jackIndex(end.jack);
	if (!item || index === null) return null;
	const jack = item.jacks[index];
	return jack
		? { kind: "item", uid: item.uid, item, jack, jackIndex: index }
		: null;
}

function cableAssumed(from: EndInfo, to: EndInfo): boolean {
	return endAssumed(from) || endAssumed(to);
}

/**
 * Tarjan strongly-connected components over the item graph. Each component with
 * more than one node (or a self-loop) is a directed cycle / feedback surface.
 */
function stronglyConnectedComponents(
	nodes: string[],
	edges: FeedbackEdge[],
): string[][] {
	const adjacency = new Map<string, FeedbackEdge[]>();
	for (const node of nodes) adjacency.set(node, []);
	for (const edge of edges) {
		adjacency.get(edge.from)?.push(edge);
		if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
	}
	let counter = 0;
	const index = new Map<string, number>();
	const low = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const result: string[][] = [];

	const visit = (node: string) => {
		index.set(node, counter);
		low.set(node, counter);
		counter += 1;
		stack.push(node);
		onStack.add(node);
		for (const edge of adjacency.get(node) ?? []) {
			const target = edge.to;
			if (!index.has(target)) {
				visit(target);
				low.set(node, Math.min(low.get(node) ?? 0, low.get(target) ?? 0));
			} else if (onStack.has(target)) {
				low.set(node, Math.min(low.get(node) ?? 0, index.get(target) ?? 0));
			}
		}
		if (low.get(node) === index.get(node)) {
			const component: string[] = [];
			let current: string | undefined;
			do {
				current = stack.pop();
				if (current === undefined) break;
				onStack.delete(current);
				component.push(current);
			} while (current !== node);
			result.push(component);
		}
	};

	for (const node of adjacency.keys()) {
		if (!index.has(node)) visit(node);
	}
	return result;
}

function push(
	issues: SignalIssue[],
	issue: Omit<SignalIssue, "itemUids" | "endpointUids" | "cableUids"> &
		Partial<Pick<SignalIssue, "itemUids" | "endpointUids" | "cableUids">>,
): void {
	issues.push({
		...issue,
		itemUids: issue.itemUids ?? [],
		endpointUids: issue.endpointUids ?? [],
		cableUids: issue.cableUids ?? [],
	});
}

/**
 * Build the whole signal-flow report for a scene. Pure: the same scene always
 * yields the same issues, counts and flags.
 */
export function buildSignalReport(scene: SignalFlowScene): SignalReport {
	const items = new Map<string, ItemInfo>();
	for (const item of scene.items) {
		items.set(item.uid, buildItemInfo(item, scene.customPedals));
	}
	const endpointMap = new Map(
		scene.endpoints.map((endpoint) => [endpoint.uid, endpoint]),
	);
	const issues: SignalIssue[] = [];
	const audioConnected = new Set<string>();
	let assumedEndCount = 0;
	const directed: DirectedCable[] = [];

	for (const cable of scene.cables) {
		const from = resolveEnd(cable.from, items, endpointMap);
		const to = resolveEnd(cable.to, items, endpointMap);
		if (!from || !to) {
			push(issues, {
				code: "dangling-cable-end",
				severity: "warning",
				title: "Cable end no longer resolves",
				detail:
					"A cable points at a part, endpoint or jack that is gone. Re-patch or delete it.",
				cableUids: [cable.uid],
				assumed: false,
			});
			continue;
		}
		const assumed = cableAssumed(from, to);
		if (from.kind === "item" && !isAudioEnd(from)) {
			push(issues, {
				code: "non-audio-cable",
				severity: "info",
				title: "Non-audio connector",
				detail: `${from.item.name} uses a non-audio connector. Only IN/OUT/SEND/RETURN carry signal today.`,
				itemUids: [from.uid],
				cableUids: [cable.uid],
				assumed,
			});
			continue;
		}
		if (to.kind === "item" && !isAudioEnd(to)) {
			push(issues, {
				code: "non-audio-cable",
				severity: "info",
				title: "Non-audio connector",
				detail: `${to.item.name} uses a non-audio connector. Only IN/OUT/SEND/RETURN carry signal today.`,
				itemUids: [to.uid],
				cableUids: [cable.uid],
				assumed,
			});
			continue;
		}
		for (const end of [from, to] as const) {
			audioConnected.add(`${end.kind}:${end.uid}`);
			if (endAssumed(end)) assumedEndCount += 1;
		}

		const fromRole = roleOfEnd(from);
		const toRole = roleOfEnd(to);

		if (
			from.kind === "item" &&
			to.kind === "item" &&
			fromRole === toRole &&
			fromRole !== "neutral"
		) {
			const bothSources = fromRole === "source";
			push(issues, {
				code: "direction-conflict",
				severity: "warning",
				title: bothSources
					? "Output patched to output"
					: "Input patched to input",
				detail: bothSources
					? `${from.item.name} and ${to.item.name} are both outputs. One end should be an input.`
					: `${from.item.name} and ${to.item.name} are both inputs. One end should be an output.`,
				itemUids: [from.uid, to.uid],
				cableUids: [cable.uid],
				assumed,
			});
		}

		if (from.kind === "endpoint" && from.endpoint.kind === "instrument") {
			if (to.kind === "item" && toRole === "source") {
				push(issues, {
					code: "instrument-bad-target",
					severity: "warning",
					title: "Instrument feeds an output",
					detail: `The instrument is patched into ${to.item.name}'s ${to.jack.kind.toUpperCase()}. It should feed an input.`,
					itemUids: [to.uid],
					endpointUids: [from.uid],
					cableUids: [cable.uid],
					assumed,
				});
			}
		}

		if (to.kind === "endpoint" && to.endpoint.kind === "instrument") {
			push(issues, {
				code: "instrument-bad-target",
				severity: "warning",
				title: "Something feeds the instrument",
				detail:
					"The instrument endpoint should only send signal into the chain.",
				itemUids: from.kind === "item" ? [from.uid] : [],
				endpointUids: [to.uid],
				cableUids: [cable.uid],
				assumed,
			});
		}

		if (from.kind === "endpoint" && from.endpoint.kind === "amp") {
			if (to.kind === "item" && toRole === "sink") {
				push(issues, {
					code: "amp-bad-source",
					severity: "warning",
					title: "Amp feeds a pedal input",
					detail: `The amp endpoint is patched into ${to.item.name}'s ${to.jack.kind.toUpperCase()} instead of receiving from an output.`,
					itemUids: [to.uid],
					endpointUids: [from.uid],
					cableUids: [cable.uid],
					assumed,
				});
			}
		}

		const fromStereo = from.kind === "item" && from.jack.stereo === true;
		const toStereo = to.kind === "item" && to.jack.stereo === true;
		if (fromStereo !== toStereo) {
			push(issues, {
				code: "trs-mono-mismatch",
				severity: "warning",
				title: "TRS patched to mono",
				detail:
					"One end is a TRS (stereo) jack and the other is mono. Confirm the cable and signal type you intend.",
				itemUids: [
					...(from.kind === "item" ? [from.uid] : []),
					...(to.kind === "item" ? [to.uid] : []),
				],
				cableUids: [cable.uid],
				assumed,
			});
		}

		if (
			from.kind === "item" &&
			to.kind === "item" &&
			((fromRole === "source" && toRole === "sink") ||
				(fromRole === "sink" && toRole === "source"))
		) {
			const source = fromRole === "source" ? from : to;
			const sink = fromRole === "source" ? to : from;
			directed.push({
				cable,
				from: source,
				to: sink,
				fromRole: "source",
				toRole: "sink",
				assumed,
			});
		}
	}

	const hasInstrument = scene.endpoints.some(
		(endpoint) => endpoint.kind === "instrument",
	);
	const hasAmp = scene.endpoints.some((endpoint) => endpoint.kind === "amp");
	const endToEnd = hasInstrument && hasAmp;

	if (scene.cables.length > 0) {
		if (endToEnd) {
			for (const endpoint of scene.endpoints) {
				if (endpoint.kind !== "instrument") continue;
				if (audioConnected.has(`endpoint:${endpoint.uid}`)) continue;
				push(issues, {
					code: "instrument-unconnected",
					severity: "warning",
					title: "Instrument is not connected",
					detail:
						"The instrument endpoint has no cable. Patch it into the first input.",
					endpointUids: [endpoint.uid],
					assumed: false,
				});
			}
		}
		if (endToEnd) {
			for (const endpoint of scene.endpoints) {
				if (endpoint.kind !== "amp") continue;
				if (audioConnected.has(`endpoint:${endpoint.uid}`)) continue;
				push(issues, {
					code: "amp-unconnected",
					severity: "warning",
					title: "Amp is not connected",
					detail:
						"The amp endpoint has no cable. Patch the last output into it.",
					endpointUids: [endpoint.uid],
					assumed: false,
				});
			}
		}

		for (const info of items.values()) {
			if (info.item.kind !== "pedal") continue;
			if (info.audioJacks.length === 0 && !info.assumed) {
				push(issues, {
					code: "pedal-no-audio-jacks",
					severity: "info",
					title: "No audio jacks defined",
					detail: `${info.name} has no audio jack (IN/OUT/SEND/RETURN), so it cannot be patched.`,
					itemUids: [info.uid],
					assumed: false,
				});
				continue;
			}
			const hasInput = info.audioJacks.some(
				(entry) => entry.jack.kind === "in",
			);
			const hasOutput = info.audioJacks.some(
				(entry) => entry.jack.kind === "out",
			);
			if (hasInput && hasOutput) continue;
			if (!hasInput) {
				push(issues, {
					code: "pedal-missing-input",
					severity: "warning",
					title: "No input jack",
					detail: `${info.name} has no IN jack, so nothing can feed it.`,
					itemUids: [info.uid],
					assumed: false,
				});
			}
			if (!hasOutput) {
				push(issues, {
					code: "pedal-missing-output",
					severity: "warning",
					title: "No output jack",
					detail: `${info.name} has no OUT jack, so it cannot feed the next part.`,
					itemUids: [info.uid],
					assumed: false,
				});
			}
		}

		const pedals = [...items.values()].filter(
			(info) => info.item.kind === "pedal",
		);
		for (const info of pedals) {
			if (info.audioJacks.length === 0 && !info.assumed) continue;
			if (audioConnected.has(`item:${info.uid}`)) continue;
			push(issues, {
				code: "unconnected-pedal",
				severity: "warning",
				title: "Pedal is not patched",
				detail: `${info.name} has no cable on any audio jack.`,
				itemUids: [info.uid],
				assumed: info.assumed,
			});
		}

		if (endToEnd) {
			const adjacency = new Map<string, Set<string>>();
			const addNode = (node: string) => {
				if (!adjacency.has(node)) adjacency.set(node, new Set());
			};
			for (const cable of scene.cables) {
				const from = resolveEnd(cable.from, items, endpointMap);
				const to = resolveEnd(cable.to, items, endpointMap);
				if (!from || !to || !isAudioEnd(from) || !isAudioEnd(to)) continue;
				const a = `${from.kind}:${from.uid}`;
				const b = `${to.kind}:${to.uid}`;
				addNode(a);
				addNode(b);
				adjacency.get(a)?.add(b);
				adjacency.get(b)?.add(a);
			}
			const seen = new Set<string>();
			for (const start of adjacency.keys()) {
				if (seen.has(start)) continue;
				const component: string[] = [];
				const queue = [start];
				seen.add(start);
				while (queue.length > 0) {
					const node = queue.pop();
					if (node === undefined) break;
					component.push(node);
					for (const next of adjacency.get(node) ?? []) {
						if (seen.has(next)) continue;
						seen.add(next);
						queue.push(next);
					}
				}
				const componentPedals = component
					.filter((node) => node.startsWith("item:"))
					.map((node) => items.get(node.slice("item:".length)))
					.filter(
						(info): info is ItemInfo =>
							info !== undefined && info.item.kind === "pedal",
					);
				if (componentPedals.length === 0) continue;
				const instruments = component.filter(
					(node) =>
						node.startsWith("endpoint:") &&
						endpointMap.get(node.slice("endpoint:".length))?.kind ===
							"instrument",
				);
				const amps = component.filter(
					(node) =>
						node.startsWith("endpoint:") &&
						endpointMap.get(node.slice("endpoint:".length))?.kind === "amp",
				);
				const assumed = componentPedals.some((info) => info.assumed);
				const pedalNames = componentPedals.map((info) => info.name);
				if (instruments.length === 0 && amps.length === 0) {
					push(issues, {
						code: "unconnected-chain",
						severity: "warning",
						title: "Chain is not connected",
						detail: `${pedalNames.join(", ")} are patched together but reach neither an instrument nor an amp.`,
						itemUids: componentPedals.map((info) => info.uid),
						assumed,
					});
				} else if (instruments.length > 0 && amps.length === 0) {
					push(issues, {
						code: "incomplete-chain",
						severity: "warning",
						title: "Chain does not reach an amp",
						detail: `${pedalNames.join(", ")} start at the instrument but never reach the amp.`,
						itemUids: componentPedals.map((info) => info.uid),
						endpointUids: instruments.map((node) =>
							node.slice("endpoint:".length),
						),
						assumed,
					});
				} else if (instruments.length === 0 && amps.length > 0) {
					push(issues, {
						code: "incomplete-chain",
						severity: "warning",
						title: "Chain does not start at an instrument",
						detail: `${pedalNames.join(", ")} reach the amp but no instrument feeds them.`,
						itemUids: componentPedals.map((info) => info.uid),
						endpointUids: amps.map((node) => node.slice("endpoint:".length)),
						assumed,
					});
				}
			}
		}

		const feedbackEdges: FeedbackEdge[] = directed.map((edge) => {
			const from = edge.from;
			const to = edge.to;
			const sourceKind =
				from.kind === "item" ? from.jack.kind : ("out" as const);
			const sinkKind = to.kind === "item" ? to.jack.kind : ("in" as const);
			return {
				from: from.uid,
				to: to.uid,
				sourceKind,
				sinkKind,
				cableUid: edge.cable.uid,
				assumed: edge.assumed,
			};
		});
		if (feedbackEdges.length > 0) {
			const nodes = [
				...new Set(feedbackEdges.flatMap((edge) => [edge.from, edge.to])),
			];
			for (const component of stronglyConnectedComponents(
				nodes,
				feedbackEdges,
			)) {
				const members = new Set(component);
				const internal = feedbackEdges.filter(
					(edge) => members.has(edge.from) && members.has(edge.to),
				);
				const hasSelfLoop = internal.some((edge) => edge.from === edge.to);
				if (component.length === 1 && !hasSelfLoop) continue;
				const assumed = internal.some((edge) => edge.assumed);
				const cableUids = internal.map((edge) => edge.cableUid);
				const effectsLoop = component.some((node) => {
					const closesReturn = internal.some(
						(edge) => edge.to === node && edge.sinkKind === "return",
					);
					const leavesSend = internal.some(
						(edge) => edge.from === node && edge.sourceKind === "send",
					);
					return closesReturn && leavesSend;
				});
				const itemUids = component;
				if (effectsLoop) {
					push(issues, {
						code: "effects-loop",
						severity: "info",
						title: "Effects loop",
						detail:
							"A signal loop closes through SEND/RETURN. This is intentional if the pedal has an effects loop.",
						itemUids,
						cableUids,
						assumed,
					});
				} else if (component.length === 2 || hasSelfLoop) {
					push(issues, {
						code: "feedback-loop-direct",
						severity: "warning",
						title: "Direct feedback loop",
						detail:
							"Two pedals feed each other. Break the loop unless you intend feedback.",
						itemUids,
						cableUids,
						assumed,
					});
				} else {
					push(issues, {
						code: "feedback-loop-indirect",
						severity: "warning",
						title: "Indirect feedback loop",
						detail:
							"The signal path circles back on itself. Break the loop unless you intend feedback.",
						itemUids,
						cableUids,
						assumed,
					});
				}
			}
		}
	}

	const warningCount = issues.filter(
		(issue) => issue.severity === "warning",
	).length;
	const infoCount = issues.length - warningCount;

	return {
		issues,
		warningCount,
		infoCount,
		checkedCables: scene.cables.length,
		assumedEndCount,
		hasInstrument,
		hasAmp,
		endToEnd,
	};
}

/** Identity cache: scene arrays are copy-on-write, so identity = mutation. */
let cachedReport: {
	boards: PlacedBoard[];
	items: PlacedItem[];
	customPedals: CustomPedal[];
	endpoints: Endpoint[];
	cables: Cable[];
	report: SignalReport;
} | null = null;

/**
 * Memoized report for the current scene mutation. The chip, dock and announcer
 * all read it, so one edit costs one O(V+E) build instead of three.
 */
export function signalReportFor(scene: SignalFlowScene): SignalReport {
	if (
		cachedReport &&
		cachedReport.boards === scene.boards &&
		cachedReport.items === scene.items &&
		cachedReport.customPedals === scene.customPedals &&
		cachedReport.endpoints === scene.endpoints &&
		cachedReport.cables === scene.cables
	) {
		return cachedReport.report;
	}
	const report = buildSignalReport(scene);
	cachedReport = { ...scene, report };
	return report;
}
