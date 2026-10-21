import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../catalog/load";
import { CAPACITY, capacityStatus } from "../lib/capacity";
import { useReadOnly } from "./readOnly";
import { useScene } from "./scene";

const pedalId = catalog.pedals[0]?.id;
if (!pedalId) throw new Error("test fixture pedal missing from the seed");

function required<T>(value: T | null): T {
	if (value === null) throw new Error("expected a value");
	return value;
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
		const itemUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 0, y: 0 }),
		);
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
		const itemUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 0, y: 0 }),
		);
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

	it("removing an endpoint removes its cables; the other endpoint survives", () => {
		const itemUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 0, y: 0 }),
		);
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
		const itemUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 0, y: 0 }),
		);
		const otherUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 20, y: 0 }),
		);
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
		const itemUid = required(
			useScene.getState().addItem(pedalId, "pedal", null, { x: 0, y: 0 }),
		);
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
