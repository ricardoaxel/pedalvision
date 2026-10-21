import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cableCurve, cablePointAt } from "../lib/cablePath";
import { cmToPx } from "../lib/geometry";
import { anchorIndexFor, cableEndAnchorFromIndex } from "../lib/jackAnchor";
import { useReadOnly } from "../state/readOnly";
import { useScene } from "../state/scene";
import {
	selectSelectedCableUid,
	selectSelectedEndpointUid,
	useSelection,
} from "../state/selection";
import { useSettings } from "../state/settings";
import { useViewport } from "../state/viewport";
import {
	ACTION_BAR_GAP,
	ACTION_BAR_MARGIN,
	ACTION_BAR_MOBILE_MEDIA,
	ACTION_BAR_TAB_BAR_HEIGHT,
} from "./actionBarLayout";

/**
 * HTML action bar for a selected cable or endpoint (P4-02). Positioned from the
 * object's screen coordinates (never a Konva shape), clamped inside the canvas
 * pane and above the mobile tab bar. Delete is the only action in v1 — cables
 * are not re-routable yet.
 */
export function GraphActionBar() {
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const removeCable = useScene((state) => state.removeCable);
	const removeEndpoint = useScene((state) => state.removeEndpoint);
	const readOnly = useReadOnly((state) => state.readOnly);
	const showCables = useSettings((state) => state.showCables);
	const selectedCableUid = useSelection(selectSelectedCableUid);
	const selectedEndpointUid = useSelection(selectSelectedEndpointUid);
	const clearSelection = useSelection((state) => state.clearSelection);
	const scale = useViewport((state) => state.scale);
	const vx = useViewport((state) => state.x);
	const vy = useViewport((state) => state.y);
	const viewportSize = useViewport((state) => state.size);

	const barRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [mobile, setMobile] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(ACTION_BAR_MOBILE_MEDIA);
		const update = () => setMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	const cable = selectedCableUid
		? cables.find((candidate) => candidate.uid === selectedCableUid)
		: undefined;
	const endpoint = selectedEndpointUid
		? endpoints.find((candidate) => candidate.uid === selectedEndpointUid)
		: undefined;
	const visible =
		!readOnly && showCables && (cable !== undefined || endpoint !== undefined);

	useLayoutEffect(() => {
		if (!visible) return;
		const bar = barRef.current;
		if (!bar) return;
		const measure = () => {
			setSize({ width: bar.offsetWidth, height: bar.offsetHeight });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(bar);
		return () => observer.disconnect();
	}, [visible]);

	if (!visible) return null;

	let anchorX = 0;
	let anchorY = 0;
	if (cable) {
		const index = anchorIndexFor({ boards, items, customPedals, endpoints });
		const from = cableEndAnchorFromIndex(cable.from, index);
		const to = cableEndAnchorFromIndex(cable.to, index);
		if (from && to) {
			const curve = cableCurve(from, to, Math.max(scale, 0.0001));
			const midpoint = cablePointAt(curve, 0.5);
			anchorX = midpoint.x * scale + vx;
			anchorY = midpoint.y * scale + vy;
		} else {
			return null;
		}
	} else if (endpoint) {
		anchorX = cmToPx(endpoint.x) * scale + vx;
		anchorY = cmToPx(endpoint.y) * scale + vy;
	}

	const half = size.width / 2;
	const viewportMin = half + ACTION_BAR_MARGIN;
	const viewportMax = Math.max(
		viewportMin,
		viewportSize.width - half - ACTION_BAR_MARGIN,
	);
	const bottomReserve = mobile ? ACTION_BAR_TAB_BAR_HEIGHT : 0;
	const left = Math.min(viewportMax, Math.max(viewportMin, anchorX));
	const top = Math.min(
		Math.max(
			ACTION_BAR_MARGIN,
			viewportSize.height - bottomReserve - size.height - ACTION_BAR_MARGIN,
		),
		Math.max(ACTION_BAR_MARGIN, anchorY + ACTION_BAR_GAP),
	);

	const remove = () => {
		if (cable) removeCable(cable.uid);
		if (endpoint) removeEndpoint(endpoint.uid);
		clearSelection();
	};

	return (
		<div
			ref={barRef}
			className="item-action-bar"
			data-testid="graph-action-bar"
			role="toolbar"
			aria-label={
				cable ? "Selected cable actions" : "Selected endpoint actions"
			}
			style={{ left: `${left}px`, top: `${top}px` }}
		>
			<button
				type="button"
				className="item-action-bar__button item-action-bar__button--danger"
				data-testid="delete-graph-item"
				aria-label={cable ? "Delete cable" : "Delete endpoint"}
				onClick={remove}
			>
				Delete
			</button>
		</div>
	);
}
