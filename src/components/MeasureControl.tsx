import { useMeasure } from "../state/measure";
import { RulerIcon } from "./icons";

/** Toolbar trigger for the transient measure mode (also `M`). */
export function MeasureControl() {
	const active = useMeasure((state) => state.active);
	const toggle = useMeasure((state) => state.toggle);
	return (
		<button
			type="button"
			className="hud-button measure-trigger"
			data-testid="measure-toggle"
			data-active={active ? "true" : undefined}
			aria-label="Measure"
			aria-pressed={active}
			title="Measure — M"
			onClick={toggle}
		>
			<RulerIcon />
			<span className="measure-trigger__label">Measure</span>
		</button>
	);
}
