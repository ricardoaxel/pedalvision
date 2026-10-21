import { useEffect, useRef, useState } from "react";
import { capacityStatus } from "../lib/capacity";
import { useCableDrag } from "../state/cableDrag";
import {
	type EndpointKind,
	useEndpointPlacement,
} from "../state/endpointPlacement";
import { resolveItemJacks, useScene } from "../state/scene";
import { useSelection } from "../state/selection";
import { useSettings } from "../state/settings";
import { pxToWorldCm, useViewport } from "../state/viewport";

/** A plug glyph (toolbar trigger). */
function PlugIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M9 2v6" />
			<path d="M15 2v6" />
			<path d="M6 8h12v3a6 6 0 0 1-6 6v5" />
		</svg>
	);
}

/**
 * "Add endpoint" toolbar control (P4-02 "Patch Drafting"). Arm-then-click:
 * choosing Amp/Instrument arms placement and the next canvas tap places it
 * exactly where the user points (the canvas stays unobstructed; no auto-drop at
 * the viewport centre). The graph hard cap is reported inline, never a toast.
 */
export function EndpointControl() {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const endpoints = useScene((state) => state.endpoints);
	const cables = useScene((state) => state.cables);
	const boards = useScene((state) => state.boards);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);
	const status = capacityStatus({
		boards,
		items,
		customPedals,
		endpoints,
		cables,
	});
	const blocked = status.graph.level === "hard";
	const armed = useEndpointPlacement((state) => state.kind !== null);
	const showCables = useSettings((state) => state.showCables);
	const setShowCables = useSettings((state) => state.setShowCables);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (target && rootRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const choose = (kind: EndpointKind) => {
		if (blocked) return;
		// Endpoints are invisible while the graph is hidden; show it first.
		if (!showCables) setShowCables(true);
		useEndpointPlacement.getState().arm(kind);
		setOpen(false);
	};

	return (
		<div ref={rootRef} className="endpoint-control">
			<button
				type="button"
				className="hud-button endpoint-control__trigger"
				data-testid="endpoint-open"
				aria-label="Add amp or instrument endpoint"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls="endpoint-popover"
				aria-pressed={armed}
				data-armed={armed ? "true" : undefined}
				title="Add endpoint"
				onClick={() => setOpen((current) => !current)}
			>
				<PlugIcon />
				<span className="endpoint-control__label">Patch</span>
			</button>
			{open ? (
				<div
					id="endpoint-popover"
					className="endpoint-popover"
					data-testid="endpoint-popover"
					role="dialog"
					aria-label="Add endpoint"
				>
					<p className="endpoint-popover__eyebrow">Patch endpoint</p>
					<button
						type="button"
						className="endpoint-popover__row"
						data-testid="endpoint-add-amp"
						disabled={blocked}
						onClick={() => choose("amp")}
					>
						<span className="endpoint-popover__glyph">▣</span>
						<span>
							<strong>Amp input</strong>
							<span className="endpoint-popover__hint">Signal destination</span>
						</span>
					</button>
					<button
						type="button"
						className="endpoint-popover__row"
						data-testid="endpoint-add-instrument"
						disabled={blocked}
						onClick={() => choose("instrument")}
					>
						<span className="endpoint-popover__glyph">◉</span>
						<span>
							<strong>Instrument</strong>
							<span className="endpoint-popover__hint">Signal source</span>
						</span>
					</button>
					{blocked ? (
						<p className="endpoint-popover__note">{status.warning}</p>
					) : null}
					<label className="endpoint-popover__toggle">
						<input
							type="checkbox"
							data-testid="toggle-cables"
							checked={showCables}
							onChange={(event) => setShowCables(event.target.checked)}
						/>
						<span>
							<strong>Show patch</strong>
							<span className="endpoint-popover__hint">
								Cables, jacks &amp; endpoints
							</span>
						</span>
					</label>
				</div>
			) : null}
		</div>
	);
}

/**
 * Full-canvas capture layer while placement is armed. It lives above the stage
 * and below the chrome, so a tap places the endpoint without starting a pan.
 */
export function EndpointPlacementOverlay() {
	const kind = useEndpointPlacement((state) => state.kind);
	const addEndpoint = useScene((state) => state.addEndpoint);
	const selectEndpoint = useSelection((state) => state.selectEndpoint);

	useEffect(() => {
		if (!kind) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			useEndpointPlacement.getState().disarm();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [kind]);

	if (!kind) return null;
	return (
		<div
			className="endpoint-placement"
			data-testid="endpoint-placement"
			role="presentation"
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.stopPropagation();
				const rect = event.currentTarget.getBoundingClientRect();
				const { scale, x, y } = useViewport.getState();
				const world = pxToWorldCm(
					{ x: event.clientX - rect.left, y: event.clientY - rect.top },
					{ scale, x, y },
				);
				const uid = addEndpoint(kind, world);
				if (uid) {
					selectEndpoint(uid);
					useEndpointPlacement.getState().disarm();
				}
			}}
		/>
	);
}

/**
 * One quiet status line for the two transient modes (drag-connect / placement).
 * Inline, polite, never a toast (N8); Cancel is a 44px action on touch.
 */
export function GraphStatusChip() {
	const kind = useEndpointPlacement((state) => state.kind);
	const source = useCableDrag((state) => state.source);
	const notice = useCableDrag((state) => state.notice);
	const items = useScene((state) => state.items);
	const customPedals = useScene((state) => state.customPedals);

	const sourceLabel = (() => {
		if (!source) return "";
		const item = items.find((candidate) => candidate.uid === source.itemUid);
		if (!item) return "a jack";
		const jack = resolveItemJacks(item, customPedals)[source.jackIndex];
		return jack ? jack.kind.toUpperCase() : "a jack";
	})();

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(
			() => useCableDrag.getState().setNotice(null),
			5_000,
		);
		return () => clearTimeout(timer);
	}, [notice]);

	if (!kind && !source && !notice) return null;
	const text = kind
		? `Place ${kind === "amp" ? "Amp input" : "Instrument"} — tap the canvas.`
		: source
			? `Connecting from ${sourceLabel} — release on a jack.`
			: (notice ?? "");

	return (
		<div
			className="graph-status"
			data-testid="graph-status"
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			<span>{text}</span>
			{kind || source ? (
				<button
					type="button"
					className="graph-status__cancel"
					data-testid="graph-status-cancel"
					onClick={() => {
						useEndpointPlacement.getState().disarm();
						useCableDrag.getState().cancel();
					}}
				>
					Cancel
				</button>
			) : null}
		</div>
	);
}
