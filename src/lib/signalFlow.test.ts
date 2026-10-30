import { describe, expect, it } from "vitest";
import type {
	Cable,
	CustomPedal,
	Endpoint,
	PlacedBoard,
	PlacedItem,
} from "../state/scene";
import {
	buildSignalReport,
	type SignalFlowScene,
	signalReportFor,
} from "./signalFlow";

const IN_OUT = [
	{ kind: "in", edge: "left", pos: 0.5 },
	{ kind: "out", edge: "right", pos: 0.5 },
] as const;

const pedal = (
	refId: string,
	jacks = IN_OUT as unknown as CustomPedal["jacks"],
	overrides: Partial<CustomPedal> = {},
): CustomPedal => ({
	refId,
	brand: "Acme",
	name: refId,
	widthCm: 10,
	heightCm: 10,
	category: "pedal",
	effectTypes: [],
	jacks,
	...overrides,
});

const item = (
	uid: string,
	refId: string,
	x: number,
	y: number,
	overrides: Partial<PlacedItem> = {},
): PlacedItem => ({
	uid,
	refId,
	kind: "pedal",
	boardUid: null,
	x,
	y,
	rotationDeg: 0,
	z: 0,
	...overrides,
});

const endpoint = (
	uid: string,
	kind: Endpoint["kind"],
	x: number,
	y: number,
): Endpoint => ({ uid, kind, x, y });

const cable = (uid: string, from: Cable["from"], to: Cable["to"]): Cable => ({
	uid,
	from,
	to,
});

function scene(overrides: Partial<SignalFlowScene> = {}): SignalFlowScene {
	return {
		boards: [] as PlacedBoard[],
		items: [],
		customPedals: [],
		endpoints: [],
		cables: [],
		...overrides,
	};
}

function codes(report: ReturnType<typeof buildSignalReport>): string[] {
	return report.issues.map((issue) => issue.code);
}

describe("buildSignalReport", () => {
	it("reports a clean instrument → pedals → amp chain", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a"), pedal("b")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 60, 0),
				],
				cables: [
					cable("c1", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
					cable("c2", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c3", { itemUid: "b", jack: "1" }, { endpointUid: "amp" }),
				],
			}),
		);
		expect(report.issues).toEqual([]);
		expect(report.warningCount).toBe(0);
		expect(report.checkedCables).toBe(3);
		expect(report.endToEnd).toBe(true);
		expect(report.assumedEndCount).toBe(0);
	});

	it("warns on output → output and input → input", () => {
		const twoOuts = [
			{ kind: "out", edge: "left", pos: 0.5 },
			{ kind: "out", edge: "right", pos: 0.5 },
		] as unknown as CustomPedal["jacks"];
		const twoIns = [
			{ kind: "in", edge: "left", pos: 0.5 },
			{ kind: "in", edge: "right", pos: 0.5 },
		] as unknown as CustomPedal["jacks"];
		const outToOut = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", twoOuts), pedal("b", twoOuts)],
				cables: [
					cable("o", { itemUid: "a", jack: "0" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(codes(outToOut)).toContain("direction-conflict");
		const issue = outToOut.issues.find(
			(entry) => entry.code === "direction-conflict",
		);
		expect(issue?.title).toBe("Output patched to output");
		expect(issue?.itemUids).toEqual(["a", "b"]);

		const inToIn = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", twoIns), pedal("b", twoIns)],
				cables: [
					cable("i", { itemUid: "a", jack: "0" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(
			inToIn.issues.find((entry) => entry.code === "direction-conflict")?.title,
		).toBe("Input patched to input");
	});

	it("warns when the instrument feeds an output", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [endpoint("inst", "instrument", 0, 0)],
				cables: [
					cable("c", { endpointUid: "inst" }, { itemUid: "a", jack: "1" }),
				],
			}),
		);
		expect(codes(report)).toContain("instrument-bad-target");
	});

	it("warns when the amp feeds a pedal input", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [endpoint("amp", "amp", 0, 0)],
				cables: [
					cable("c", { endpointUid: "amp" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(codes(report)).toContain("amp-bad-source");
		expect(codes(report)).not.toContain("amp-unconnected");
	});

	it("warns when a real jack set has no input or no output", () => {
		const onlyOut = [
			{ kind: "out", edge: "right", pos: 0.5 },
		] as unknown as CustomPedal["jacks"];
		const onlyIn = [
			{ kind: "in", edge: "left", pos: 0.5 },
		] as unknown as CustomPedal["jacks"];
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", onlyOut), pedal("b", onlyIn)],
				cables: [
					cable("c", { itemUid: "a", jack: "0" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(codes(report)).toContain("pedal-missing-input");
		expect(codes(report)).toContain("pedal-missing-output");
	});

	it("treats a custom pedal with no jacks as info, not a warning", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [
					pedal("a", [] as unknown as CustomPedal["jacks"]),
					pedal("b"),
				],
				cables: [
					cable("c", { itemUid: "a", jack: "0" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		// A has no jacks, so the cable end does not resolve.
		expect(codes(report)).toContain("dangling-cable-end");
		expect(codes(report)).toContain("pedal-no-audio-jacks");
		expect(
			report.issues.find((entry) => entry.code === "unconnected-pedal")
				?.itemUids,
		).toEqual(["b"]);
		expect(codes(report)).not.toContain("pedal-missing-input");
		expect(codes(report)).not.toContain("pedal-missing-output");
	});

	it("reports a non-audio connector as info, never a cable warning", () => {
		const jacks = [
			{ kind: "in", edge: "left", pos: 0.5 },
			{ kind: "out", edge: "right", pos: 0.5 },
			{ kind: "midi", edge: "top", pos: 0.3 },
			{ kind: "midi", edge: "top", pos: 0.7 },
		] as unknown as CustomPedal["jacks"];
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a", jacks)],
				cables: [
					cable("c", { itemUid: "a", jack: "2" }, { itemUid: "a", jack: "3" }),
				],
			}),
		);
		expect(codes(report)).toContain("non-audio-cable");
		// The only cable is non-audio, so the pedal's audio jacks are still
		// unpatched; the non-audio cable itself never produces a cable warning.
		expect(codes(report)).toContain("unconnected-pedal");
		expect(codes(report)).not.toContain("direction-conflict");
		expect(codes(report)).not.toContain("trs-mono-mismatch");
	});

	it("reports a dangling cable end defensively", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				cables: [
					cable(
						"c",
						{ itemUid: "a", jack: "0" },
						{ itemUid: "gone", jack: "0" },
					),
				],
			}),
		);
		expect(codes(report)).toContain("dangling-cable-end");
	});

	it("warns on TRS → mono but not on TRS with a single stereo cable", () => {
		const stereo = [
			{ kind: "in", edge: "left", pos: 0.5, stereo: true },
			{ kind: "out", edge: "right", pos: 0.5, stereo: true },
		] as unknown as CustomPedal["jacks"];
		const mismatch = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", stereo), pedal("b")],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(codes(mismatch)).toContain("trs-mono-mismatch");
		const bothStereo = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", stereo), pedal("b", stereo)],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(codes(bothStereo)).not.toContain("trs-mono-mismatch");
		expect(bothStereo.warningCount).toBe(0);
	});

	it("warns on an unpatched pedal when other pedals are patched", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("a", "a", 10, 10),
					item("b", "b", 40, 10),
					item("c", "c", 80, 10),
				],
				customPedals: [pedal("a"), pedal("b"), pedal("c")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 100, 0),
				],
				cables: [
					cable("c1", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
					cable("c2", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c3", { itemUid: "b", jack: "1" }, { endpointUid: "amp" }),
				],
			}),
		);
		const issue = report.issues.find(
			(entry) => entry.code === "unconnected-pedal",
		);
		expect(issue?.itemUids).toEqual(["c"]);
	});

	it("warns on a chain that reaches neither instrument nor amp", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("a", "a", 10, 10),
					item("b", "b", 40, 10),
					item("x", "x", 70, 10),
					item("y", "y", 100, 10),
				],
				customPedals: [pedal("a"), pedal("b"), pedal("x"), pedal("y")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 130, 0),
				],
				cables: [
					cable("c1", { endpointUid: "inst" }, { itemUid: "x", jack: "0" }),
					cable("c2", { itemUid: "x", jack: "1" }, { itemUid: "y", jack: "0" }),
					cable("c3", { itemUid: "y", jack: "1" }, { endpointUid: "amp" }),
					cable("c4", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		const chain = report.issues.filter(
			(entry) => entry.code === "unconnected-chain",
		);
		expect(chain).toHaveLength(1);
		expect(chain[0]?.itemUids.sort()).toEqual(["a", "b"]);
	});

	it("warns on a chain that does not reach the amp", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a"), pedal("b")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 130, 0),
				],
				cables: [
					cable("c1", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
					cable("c2", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		const chain = report.issues.find(
			(entry) => entry.code === "incomplete-chain",
		);
		expect(chain?.title).toBe("Chain does not reach an amp");
		expect(codes(report)).toContain("amp-unconnected");
	});

	it("warns on direct and indirect feedback loops", () => {
		const direct = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a"), pedal("b")],
				cables: [
					cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(codes(direct)).toContain("feedback-loop-direct");

		const indirect = buildSignalReport(
			scene({
				items: [
					item("a", "a", 10, 10),
					item("b", "b", 40, 10),
					item("c", "c", 70, 10),
				],
				customPedals: [pedal("a"), pedal("b"), pedal("c")],
				cables: [
					cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "c", jack: "0" }),
					cable("c3", { itemUid: "c", jack: "1" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(codes(indirect)).toContain("feedback-loop-indirect");
	});

	it("treats a SEND/RETURN loop as an intentional effects loop (info)", () => {
		const loopJacks = [
			{ kind: "in", edge: "left", pos: 0.5 },
			{ kind: "out", edge: "right", pos: 0.5 },
			{ kind: "send", edge: "top", pos: 0.3 },
			{ kind: "return", edge: "top", pos: 0.7 },
		] as unknown as CustomPedal["jacks"];
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a", loopJacks), pedal("b")],
				cables: [
					cable("c1", { itemUid: "a", jack: "2" }, { itemUid: "b", jack: "0" }),
					cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "a", jack: "3" }),
				],
			}),
		);
		expect(codes(report)).toContain("effects-loop");
		expect(codes(report)).not.toContain("feedback-loop-direct");
		expect(report.warningCount).toBe(0);
	});

	it("discloses assumed fallback anchors without false missing-jack errors", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("a", "red-panda-rd-1-pitch-delay", 10, 10),
					item("b", "b", 40, 10),
				],
				customPedals: [pedal("b")],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
				],
			}),
		);
		expect(report.issues).toEqual([]);
		expect(report.assumedEndCount).toBe(1);
	});

	it("marks findings that depend on assumed anchors", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("a", "red-panda-rd-1-pitch-delay", 10, 10),
					item("b", "red-panda-rd-1-pitch-delay", 40, 10),
				],
				customPedals: [],
				cables: [
					cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		const issue = report.issues.find((entry) =>
			entry.code.startsWith("feedback-loop"),
		);
		expect(issue?.assumed).toBe(true);
		expect(report.assumedEndCount).toBe(4);
	});

	it("stays quiet without cables and does not guess end-to-end", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a"), pedal("b")],
				endpoints: [endpoint("inst", "instrument", 0, 0)],
			}),
		);
		expect(report.issues).toEqual([]);
		expect(report.warningCount).toBe(0);
		expect(report.endToEnd).toBe(false);
	});

	it("ignores supplies for signal-flow rules", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("a", "a", 10, 10),
					item("p", "custom-supply", 40, 10, { kind: "supply" }),
				],
				customPedals: [pedal("a")],
				cables: [],
			}),
		);
		expect(report.issues).toEqual([]);
	});

	it("memoizes per scene mutation and rebuilds on a new array", () => {
		const sceneValue = scene({
			items: [item("a", "a", 10, 10)],
			customPedals: [pedal("a")],
		});
		const first = signalReportFor(sceneValue);
		expect(signalReportFor(sceneValue)).toBe(first);
		const next = signalReportFor({
			...sceneValue,
			items: [...sceneValue.items],
		});
		expect(next).not.toBe(first);
	});

	it("treats a catalog pedal with only non-audio jacks as info", () => {
		const report = buildSignalReport(
			scene({
				items: [
					item("h", "electro-harmonix-15watt-howitzer", 10, 10),
					item("b", "b", 40, 10),
					item("c", "c", 70, 10),
				],
				customPedals: [pedal("b"), pedal("c")],
				cables: [
					cable("c1", { itemUid: "b", jack: "1" }, { itemUid: "c", jack: "0" }),
				],
			}),
		);
		expect(codes(report)).toContain("pedal-no-audio-jacks");
		expect(codes(report)).not.toContain("pedal-missing-input");
		expect(codes(report)).not.toContain("pedal-missing-output");
		expect(
			report.issues.find((entry) => entry.code === "pedal-no-audio-jacks")
				?.severity,
		).toBe("info");
	});

	it("warns when the instrument is unconnected only when both endpoints exist", () => {
		const withAmp = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 40, 0),
				],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { endpointUid: "amp" }),
				],
			}),
		);
		expect(codes(withAmp)).toContain("instrument-unconnected");
		const withoutAmp = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [endpoint("inst", "instrument", 0, 0)],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(codes(withoutAmp)).not.toContain("instrument-unconnected");
	});

	it("warns when the amp is unconnected", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 40, 0),
				],
				cables: [
					cable("c", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(codes(report)).toContain("amp-unconnected");
	});

	it("warns when something feeds the instrument endpoint", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [endpoint("inst", "instrument", 40, 0)],
				cables: [
					cable("c", { itemUid: "a", jack: "1" }, { endpointUid: "inst" }),
				],
			}),
		);
		expect(
			report.issues.find((entry) => entry.code === "instrument-bad-target")
				?.title,
		).toBe("Something feeds the instrument");
	});

	it("warns when a chain reaches the amp but not an instrument", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("c", "c", 40, 10)],
				customPedals: [pedal("a"), pedal("c")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 70, 0),
				],
				cables: [
					cable("c1", { endpointUid: "inst" }, { itemUid: "a", jack: "0" }),
					cable("c2", { itemUid: "c", jack: "1" }, { endpointUid: "amp" }),
				],
			}),
		);
		const chainTitles = report.issues
			.filter((entry) => entry.code === "incomplete-chain")
			.map((entry) => entry.title);
		expect(chainTitles).toContain("Chain does not start at an instrument");
	});

	it("warns about a lone unpatched pedal when the scene has cables", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				endpoints: [
					endpoint("inst", "instrument", 0, 0),
					endpoint("amp", "amp", 40, 0),
				],
				cables: [cable("c", { endpointUid: "inst" }, { endpointUid: "amp" })],
			}),
		);
		expect(
			report.issues.find((entry) => entry.code === "unconnected-pedal")
				?.itemUids,
		).toEqual(["a"]);
	});

	it("reports a feedback loop once per component", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
				customPedals: [pedal("a"), pedal("b")],
				cables: [
					cable("c1", { itemUid: "a", jack: "1" }, { itemUid: "b", jack: "0" }),
					cable("c2", { itemUid: "b", jack: "1" }, { itemUid: "a", jack: "0" }),
				],
			}),
		);
		expect(
			report.issues.filter((entry) => entry.code.startsWith("feedback-loop")),
		).toHaveLength(1);
	});

	it("keeps scene order for same-code issues", () => {
		const report = buildSignalReport(
			scene({
				items: [item("a", "a", 10, 10)],
				customPedals: [pedal("a")],
				cables: [
					cable(
						"c2",
						{ itemUid: "a", jack: "0" },
						{ itemUid: "gone", jack: "0" },
					),
					cable(
						"c1",
						{ itemUid: "gone", jack: "0" },
						{ itemUid: "a", jack: "1" },
					),
				],
			}),
		);
		expect(
			report.issues
				.filter((entry) => entry.code === "dangling-cable-end")
				.map((entry) => entry.cableUids[0]),
		).toEqual(["c2", "c1"]);
	});

	it("is deterministic across repeated builds", () => {
		const build = () =>
			buildSignalReport(
				scene({
					items: [item("a", "a", 10, 10), item("b", "b", 40, 10)],
					customPedals: [pedal("a"), pedal("b")],
					endpoints: [endpoint("amp", "amp", 60, 0)],
					cables: [
						cable(
							"c1",
							{ itemUid: "a", jack: "1" },
							{ itemUid: "b", jack: "0" },
						),
						cable(
							"c2",
							{ itemUid: "b", jack: "1" },
							{ itemUid: "a", jack: "0" },
						),
					],
				}),
			);
		expect(build()).toEqual(build());
	});
});
