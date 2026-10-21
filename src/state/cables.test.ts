import { beforeEach, describe, expect, it } from "vitest";
import { CAPACITY, capacityStatus } from "../lib/capacity";
import { useReadOnly } from "./readOnly";
import { pruneCableGraph, useScene } from "./scene";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
}

/** A custom item with two jacks (the catalog seed carries no jack data yet). */
function addJackedItem(x = 0): string {
	const refId = required(
		useScene.getState().addCustomPedal({
			brand: "Acme",
			name: "Jacked",
			widthCm: 7,
			heightCm: 12,
			category: "pedal",
			effectTypes: [],
			jacks: [
				{ kind: "in", edge: "top", pos: 0.5 },
				{ kind: "out", edge: "bottom", pos: 0.5 },
			],
		}),
	);
	return required(
		useScene.getState().addItem(refId, "pedal", null, { x, y: 0 }),
	);
}

function reset(): void {
	useScene.setState({
		boards: [],
		items: [],
		customPedals: [],
		endpoints: [],
		cables: [],
	});
	useReadOnly.setState({ readOnly: false });
}

beforeEach(reset);

describe("endpoints + cables (P4-01)", () => {
	it("adds, moves and removes an endpoint in world cm", () => {
		const uid = required(
			useScene.getState().addEndpoint("instrument", { x: 5, y: 6 }),
		);
		expect(useScene.getState().endpoints).toEqual([
			{ uid, kind: "instrument", x: 5, y: 6 },
		]);
		useScene.getState().moveEndpoint(uid, { x: -2, y: 9 });
		expect(useScene.getState().endpoints[0]).toEqual({
			uid,
			kind: "instrument",
			x: -2,
			y: 9,
		});
		useScene.getState().removeEndpoint(uid);
		expect(useScene.getState().endpoints).toEqual([]);
	});

	it("connects an item jack to an endpoint and persists both counts", () => {
		const itemUid = addJackedItem();
		const endpointUid = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		const cableUid = required(
			useScene.getState().addCable({ itemUid, jack: "0" }, { endpointUid }),
		);
		expect(useScene.getState().cables).toEqual([
			{
				uid: cableUid,
				from: { itemUid, jack: "0" },
				to: { endpointUid },
			},
		]);
		const status = capacityStatus(useScene.getState());
		expect(status.counts.cables).toBe(1);
		expect(status.counts.endpoints).toBe(1);
		expect(status.counts.graph).toBe(2);
	});

	it("rejects a cable whose item or endpoint is gone", () => {
		const itemUid = addJackedItem();
		expect(
			useScene
				.getState()
				.addCable({ itemUid, jack: "0" }, { endpointUid: "missing" }),
		).toBeNull();
		expect(
			useScene
				.getState()
				.addCable({ itemUid: "missing", jack: "0" }, { itemUid, jack: "1" }),
		).toBeNull();
		expect(useScene.getState().cables).toEqual([]);
	});

	it("rejects a cable with an unresolvable jack index", () => {
		const itemUid = addJackedItem();
		const endpointUid = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		expect(
			useScene.getState().addCable({ itemUid, jack: "9" }, { endpointUid }),
		).toBeNull();
		expect(
			useScene.getState().addCable({ itemUid, jack: "in" }, { endpointUid }),
		).toBeNull();
		// The catalog seed has no jack data yet: a catalog pedal resolves to the
		// documented fallback pair, so index 0 (IN) works and index 2 does not.
		const catalogUid = required(
			useScene
				.getState()
				.addItem("boss-bd-2-blues-driver", "pedal", null, { x: 0, y: 0 }),
		);
		expect(
			useScene
				.getState()
				.addCable({ itemUid: catalogUid, jack: "0" }, { endpointUid }),
		).not.toBeNull();
		expect(
			useScene
				.getState()
				.addCable({ itemUid: catalogUid, jack: "2" }, { endpointUid }),
		).toBeNull();
		expect(useScene.getState().cables).toHaveLength(1);
		expect(
			useScene.getState().addCable({ itemUid, jack: "1" }, { endpointUid }),
		).not.toBeNull();
	});

	it("prunes dead cables + orphaned endpoints when a custom jack is edited away", () => {
		const itemUid = addJackedItem();
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		if (!item) throw new Error("expected the placed item");
		const amp = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		const standalone = required(
			useScene.getState().addEndpoint("instrument", { x: -20, y: 10 }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid, jack: "1" }, { endpointUid: amp }),
		);
		expect(useScene.getState().cables).toHaveLength(1);

		// Remove the second jack (index 1) — the cable to it can no longer resolve.
		useScene.getState().updateCustomPedal(item.refId, {
			brand: "Acme",
			name: "Jacked",
			widthCm: 7,
			heightCm: 12,
			category: "pedal",
			effectTypes: [],
			jacks: [{ kind: "in", edge: "top", pos: 0.5 }],
		});

		expect(useScene.getState().cables).toEqual([]);
		// The endpoint that only existed for the dropped cable is pruned; the
		// standalone one is a placed object and survives (A4).
		expect(
			useScene.getState().endpoints.map((endpoint) => endpoint.uid),
		).toEqual([standalone]);
	});

	it("refuses a duplicate cable in either direction", () => {
		const itemUid = addJackedItem();
		const endpointUid = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		expect(
			useScene.getState().addCable({ itemUid, jack: "0" }, { endpointUid }),
		).not.toBeNull();
		// Same pair (same direction) and the reverse direction are both no-ops.
		expect(
			useScene.getState().addCable({ itemUid, jack: "0" }, { endpointUid }),
		).toBeNull();
		expect(
			useScene.getState().addCable({ endpointUid }, { itemUid, jack: "0" }),
		).toBeNull();
		expect(useScene.getState().cables).toHaveLength(1);
	});

	it("prunes duplicate unordered cable pairs during normalisation", () => {
		const itemUid = addJackedItem();
		const endpointUid = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		const endpoint = useScene
			.getState()
			.endpoints.find((entry) => entry.uid === endpointUid);
		if (!endpoint) throw new Error("expected the endpoint");
		const item = useScene
			.getState()
			.items.find((candidate) => candidate.uid === itemUid);
		if (!item) throw new Error("expected the placed item");
		const graph = pruneCableGraph(
			[
				{ uid: "c1", from: { itemUid, jack: "0" }, to: { endpointUid } },
				{ uid: "c2", from: { endpointUid }, to: { itemUid, jack: "0" } },
			],
			[endpoint],
			[item],
			useScene.getState().customPedals,
		);
		expect(graph.cables.map((cable) => cable.uid)).toEqual(["c1"]);
		expect(graph.endpoints.map((entry) => entry.uid)).toEqual([endpointUid]);
	});

	it("removing an endpoint removes its cables; the other endpoint survives", () => {
		const itemUid = addJackedItem();
		const amp = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 10 }),
		);
		const instrument = required(
			useScene.getState().addEndpoint("instrument", { x: -20, y: 10 }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid, jack: "0" }, { endpointUid: amp }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid, jack: "1" }, { endpointUid: instrument }),
		);
		useScene.getState().removeEndpoint(amp);
		expect(useScene.getState().cables).toHaveLength(1);
		expect(useScene.getState().cables[0]?.to).toEqual({
			endpointUid: instrument,
		});
		expect(
			useScene.getState().endpoints.map((endpoint) => endpoint.uid),
		).toEqual([instrument]);
	});

	it("removing an item removes every cable that terminated on it", () => {
		const itemUid = addJackedItem();
		const otherUid = addJackedItem(20);
		const endpointUid = required(
			useScene.getState().addEndpoint("amp", { x: 40, y: 0 }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid, jack: "0" }, { itemUid: otherUid, jack: "1" }),
		);
		required(
			useScene
				.getState()
				.addCable({ itemUid: otherUid, jack: "0" }, { endpointUid }),
		);
		useScene.getState().removeItem(otherUid);
		expect(useScene.getState().cables).toEqual([]);
		expect(useScene.getState().items.map((item) => item.uid)).toEqual([
			itemUid,
		]);
	});

	it("enforces the shared graph hard cap on endpoints and cables", () => {
		for (let index = 0; index < CAPACITY.graph.hard; index++) {
			expect(
				useScene.getState().addEndpoint("amp", { x: index, y: 0 }),
			).not.toBeNull();
		}
		expect(useScene.getState().endpoints).toHaveLength(CAPACITY.graph.hard);
		expect(useScene.getState().addEndpoint("amp", { x: 0, y: 0 })).toBeNull();
		const itemUid = addJackedItem();
		const endpointUid = useScene.getState().endpoints[0]?.uid;
		if (!endpointUid) throw new Error("expected an endpoint");
		expect(
			useScene.getState().addCable({ itemUid, jack: "0" }, { endpointUid }),
		).toBeNull();
	});

	it("is a no-op in read-only previews", () => {
		useReadOnly.setState({ readOnly: true });
		expect(useScene.getState().addEndpoint("amp", { x: 0, y: 0 })).toBeNull();
		expect(
			useScene
				.getState()
				.addCable({ itemUid: "i1", jack: "0" }, { itemUid: "i2", jack: "1" }),
		).toBeNull();
		expect(useScene.getState().endpoints).toEqual([]);
		expect(useScene.getState().cables).toEqual([]);
	});
});
