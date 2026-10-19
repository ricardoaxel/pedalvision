import { useId } from "react";
import type { JackEdge, JackKind } from "../catalog/schema";
import type { BoardTexture } from "../lib/boardTexture";
import { formatDimension } from "../lib/customPedal";
import type { DisplayUnits } from "../lib/geometry";

/** The minimum a jack needs to be drawn (an id enables active-jack emphasis). */
export interface DrawingJack {
	id?: string;
	kind: JackKind;
	edge: JackEdge;
	pos: number;
}

/**
 * A live dimensioned drawing of a part: the true-aspect footprint with a
 * dog-eared top-right corner, mono dimension callouts, and a dot per jack
 * (reading-order position along its edge). The actively edited jack's dot is
 * accent (edit surfaces only — read-only uses leave it neutral).
 *
 * Shared by the P2-02 "Datasheet" creator and the P2-03 "Specimen Readout"
 * panel's custom-part preview. Purely presentational; on-plate ink/stroke use
 * the theme-invariant `--color-plate-*` tokens (the plate is light in both
 * themes).
 */
export function PartDrawing({
	widthCm,
	depthCm,
	jacks,
	units,
	activeJackId,
	finish,
}: {
	widthCm: number | null;
	depthCm: number | null;
	jacks: DrawingJack[];
	units: DisplayUnits;
	activeJackId?: string | null;
	/** Board surface finish (P2-05) — fills the body with a procedural pattern. */
	finish?: BoardTexture;
}) {
	const patternId = useId();
	const w = widthCm && widthCm > 0 ? widthCm : 6;
	const h = depthCm && depthCm > 0 ? depthCm : 12;
	const pad = Math.max(w, h) * 0.32;
	const notch = Math.min(w, h) * 0.22;
	const stroke = Math.max(w, h) * 0.012;
	const dotR = Math.max(Math.min(w, h) * 0.06, Math.max(w, h) * 0.028);
	const font = Math.max(w, h) * 0.11;
	const tile = Math.max(w, h) * 0.06;
	const body = `0,0 ${w - notch},0 ${w},${notch} ${w},${h} 0,${h}`;
	const widthLabel =
		widthCm !== null ? `${formatDimension(widthCm, units)} ${units}` : "—";
	const depthLabel =
		depthCm !== null ? `${formatDimension(depthCm, units)} ${units}` : "—";

	return (
		<svg
			className="part-drawing"
			viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
		>
			{finish ? (
				<defs>
					<FinishPattern id={patternId} finish={finish} tile={tile} />
				</defs>
			) : null}
			<polygon
				className="part-drawing__body"
				points={body}
				style={{
					strokeWidth: stroke,
					...(finish ? { fill: `url(#${patternId})` } : {}),
				}}
			/>
			<line
				className="part-drawing__fold"
				x1={w - notch}
				y1={0}
				x2={w}
				y2={notch}
				style={{ strokeWidth: stroke }}
			/>
			<text
				className="part-drawing__dim"
				x={w / 2}
				y={-pad * 0.42}
				textAnchor="middle"
				style={{ fontSize: font }}
			>
				{widthLabel}
			</text>
			<text
				className="part-drawing__dim"
				x={-pad * 0.5}
				y={h / 2}
				textAnchor="middle"
				transform={`rotate(-90 ${-pad * 0.5} ${h / 2})`}
				style={{ fontSize: font }}
			>
				{depthLabel}
			</text>
			{jacks.map((jack, index) => {
				const point = jackPoint(jack.edge, jack.pos, w, h);
				return (
					<circle
						key={jack.id ?? `${jack.kind}:${jack.edge}:${jack.pos}:${index}`}
						className={`part-drawing__dot${
							jack.id !== undefined && jack.id === activeJackId
								? " part-drawing__dot--active"
								: ""
						}`}
						cx={point.x}
						cy={point.y}
						r={dotR}
						style={{ strokeWidth: stroke }}
					/>
				);
			})}
		</svg>
	);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** A jack's point on the part, in cm within the drawing frame. */
function jackPoint(
	edge: JackEdge,
	pos: number,
	widthCm: number,
	depthCm: number,
): { x: number; y: number } {
	const t = clamp01(pos);
	switch (edge) {
		case "top":
			return { x: widthCm * t, y: 0 };
		case "bottom":
			return { x: widthCm * t, y: depthCm };
		case "left":
			return { x: 0, y: depthCm * t };
		default:
			return { x: widthCm, y: depthCm * t };
	}
}

/**
 * An inline SVG `<pattern>` for a board finish (P2-05) — the drawing's analogue
 * of the canvas tile. Uses the same tokens (`var(--color-finish-*)`), so the
 * creator preview and the canvas agree in both themes.
 */
function FinishPattern({
	id,
	finish,
	tile,
}: {
	id: string;
	finish: BoardTexture;
	tile: number;
}) {
	const base = `var(--color-finish-${finish})`;
	const ink = `var(--color-finish-${finish}-ink)`;
	const mark = tile * 0.08;
	return (
		<pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
			<rect width={tile} height={tile} fill={base} />
			{finish === "matte" ? null : finish === "brushed" ? (
				[0.25, 0.6].map((fraction) => (
					<line
						key={fraction}
						x1={0}
						y1={tile * fraction}
						x2={tile}
						y2={tile * fraction}
						stroke={ink}
						strokeWidth={mark}
					/>
				))
			) : finish === "wood" ? (
				[0.2, 0.45, 0.7, 0.9].map((fraction) => (
					<line
						key={fraction}
						x1={tile * fraction}
						y1={0}
						x2={tile * fraction}
						y2={tile}
						stroke={ink}
						strokeWidth={mark}
					/>
				))
			) : (
				<>
					<circle cx={tile * 0.3} cy={tile * 0.3} r={mark * 1.3} fill={ink} />
					<circle cx={tile * 0.7} cy={tile * 0.7} r={mark * 1.3} fill={ink} />
				</>
			)}
		</pattern>
	);
}
