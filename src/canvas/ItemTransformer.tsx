import type Konva from "konva";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Transformer } from "react-konva";
import { pxToCm } from "../lib/geometry";
import { useGesture } from "../state/gesture";
import { useScene } from "../state/scene";
import type { CanvasTheme } from "../styles/theme";
import { getItemNode, subscribeItemNodes } from "./itemNodeRegistry";
import { useShiftKey } from "./useShiftKey";

/**
 * Rotate-handle visual size (px) and the hit outline that enlarges it. The
 * visible knob is 18px; the hit outline takes it to ~44px (designer +
 * design-reviewer asked for a thumb-friendly target; the task's "~28px" was the
 * floor).
 */
const ANCHOR_SIZE = 18;
const ANCHOR_HIT_STROKE = 26;

/** 15° snap used while Shift is held (design.md → free rotation). */
const SNAP_DEGREES = 15;
const ROTATION_SNAPS = Array.from(
	{ length: 360 / SNAP_DEGREES },
	(_, index) => index * SNAP_DEGREES,
);
/** Must be ≥ half the snap step so any angle lands on the nearest 15°. */
const SNAP_TOLERANCE = SNAP_DEGREES / 2;

interface ItemTransformerProps {
	/**
	 * The item to attach to, or `null` when nothing is attached (no selection, or
	 * the item is lifted mid-drag). The Transformer stays mounted regardless so a
	 * rotation interrupted by a selection change is still committed.
	 */
	selectedUid: string | null;
	theme: CanvasTheme;
}

/**
 * The single rotate Transformer for the selected pedal/supply (P1-05), living
 * in the world-space SelectionLayer. It attaches to the item's Konva node via
 * the global registry (the node may be inside a board group or the loose
 * layer); Konva decomposes the parent transform, so an item on a rotated board
 * stores its rotation relative to the pedal and never touches the board. No
 * resize anchors: footprints come from the catalog.
 *
 * Committing reads the node's local `x()`/`y()`/`rotation()` after Konva has
 * applied the parent-transform decomposition.
 */
export function ItemTransformer({ selectedUid, theme }: ItemTransformerProps) {
	const navigating = useGesture((state) => state.navigating);
	const shiftDown = useShiftKey();
	const transformerRef = useRef<Konva.Transformer>(null);
	// Captured at transformstart so a live rotation is committed even if the
	// selection is cleared before transformend.
	const transformingUidRef = useRef<string | null>(null);
	const [attached, setAttached] = useState(false);

	const commit = useCallback(() => {
		const node = transformerRef.current?.nodes()[0];
		const uid = transformingUidRef.current;
		transformingUidRef.current = null;
		if (!node || !uid) return;
		useScene
			.getState()
			.transformItem(uid, pxToCm(node.x()), pxToCm(node.y()), node.rotation());
	}, []);

	// Attach/detach on selection change. This component stays mounted across
	// selection changes (SelectionLayer always renders it), so the commit runs
	// here — before the node is detached — rather than in an unmount cleanup
	// whose transformer ref React has already cleared. `sync` also runs on every
	// node registration, because a child PedalNode registers its node in a
	// *passive* effect (after this layout effect) and a cross-board drop
	// reparents the node under the same uid.
	useLayoutEffect(() => {
		const transformer = transformerRef.current;
		if (!transformer) return;
		const sync = () => {
			const node = selectedUid ? getItemNode(selectedUid) : null;
			transformer.nodes(node ? [node] : []);
			setAttached(Boolean(node));
		};
		if (transformer.isTransforming()) commit();
		sync();
		return subscribeItemNodes(sync);
	}, [selectedUid, commit]);

	// A pan/pinch takes the gesture over: commit + stop the live rotation so the
	// pedal can't keep rotating while the viewport moves (mirrors BoardLayer).
	useLayoutEffect(() => {
		if (!navigating) return;
		const transformer = transformerRef.current;
		if (!transformer?.isTransforming()) return;
		commit();
		transformer.stopTransform();
	}, [navigating, commit]);

	// The touch handle is an enlarged hit area around a small circular knob
	// (~44px total) so rotation is thumb-friendly without a fat visual dot.
	const styleAnchor = useCallback((anchor: Konva.Rect) => {
		if (anchor.hasName("rotater")) {
			anchor.cornerRadius(anchor.width() / 2);
			anchor.hitStrokeWidth(ANCHOR_HIT_STROKE);
		}
	}, []);

	return (
		<Transformer
			ref={transformerRef}
			visible={attached}
			enabledAnchors={[]}
			resizeEnabled={false}
			rotateEnabled
			listening={attached && !navigating}
			rotationSnaps={shiftDown ? ROTATION_SNAPS : []}
			rotationSnapTolerance={SNAP_TOLERANCE}
			onTransformStart={() => {
				transformingUidRef.current = selectedUid;
			}}
			onTransformEnd={commit}
			anchorStyleFunc={styleAnchor}
			borderStroke={theme.selectionStrong}
			borderStrokeWidth={1.5}
			anchorStroke={theme.selectionStrong}
			anchorFill={theme.canvasBackground}
			anchorStrokeWidth={2.5}
			anchorSize={ANCHOR_SIZE}
			rotateAnchorOffset={30}
			ignoreStroke
		/>
	);
}
