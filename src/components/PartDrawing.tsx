import type { JackEdge, JackKind } from "../catalog/schema";
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
}: {
	widthCm: number | null;
	depthCm: number | null;
	jacks: DrawingJack[];
	units: DisplayUnits;
	activeJackId?: string | null;
}) {
	const w = widthCm && widthCm > 0 ? widthCm : 6;
	const h = depthCm && depthCm > 0 ? depthCm : 12;
	const pad = Math.max(w, h) * 0.32;
	const notch = Math.min(w, h) * 0.22;
	const stroke = Math.max(w, h) * 0.012;
	const dotR = Math.max(Math.min(w, h) * 0.06, Math.max(w, h) * 0.028);
	const font = Math.max(w, h) * 0.11;
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
			<polygon
				className="part-drawing__body"
				points={body}
				style={{ strokeWidth: stroke }}
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
