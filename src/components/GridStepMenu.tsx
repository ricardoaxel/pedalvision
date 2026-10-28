import { useEffect, useId, useRef, useState } from "react";
import { cmToDisplay } from "../lib/geometry";
import { GRID_STEPS, type GridStepCm } from "../lib/grid";
import { useSettings } from "../state/settings";

interface GridStepMenuProps {
	/** The pitch currently drawn (after the 16 px floor), in cm. */
	visibleCm: number;
	units: "cm" | "in";
}

/**
 * The grid-step trigger + popover (F-03 "Margin Rule"). The selected step is a
 * precision ceiling; the readout shows the pitch actually drawn, so the strip
 * never claims dots the canvas does not show.
 */
export function GridStepMenu({ visibleCm, units }: GridStepMenuProps) {
	const stepCm = useSettings((state) => state.gridStepCm);
	const setGridStepCm = useSettings((state) => state.setGridStepCm);
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuId = useId();
	const display = Math.round(cmToDisplay(visibleCm, units));
	const tooFine = Math.abs(visibleCm - stepCm) > 0.01;

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				!menuRef.current?.contains(target) &&
				!triggerRef.current?.contains(target)
			) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const checked = menuRef.current?.querySelector<HTMLInputElement>(
			'input[type="radio"]:checked',
		);
		checked?.focus();
	}, [open]);

	return (
		<span className="grid-step">
			<button
				ref={triggerRef}
				type="button"
				className="scale-readout__grid"
				data-testid="grid-step-trigger"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				aria-label={`Grid step, ${stepCm} centimetres`}
				onClick={() => setOpen((value) => !value)}
			>
				grid {display} {units}
				<span className="scale-readout__chevron" aria-hidden="true">
					⌄
				</span>
			</button>
			{open ? (
				<div
					ref={menuRef}
					id={menuId}
					className="grid-step__menu"
					role="dialog"
					aria-label="Grid step"
				>
					<div className="grid-step__header">Grid step</div>
					<fieldset className="grid-step__options">
						<legend className="visually-hidden">Grid step</legend>
						{GRID_STEPS.map((step) => (
							<label
								key={step}
								className="grid-step__option"
								data-testid={`grid-step-${step}`}
							>
								<input
									type="radio"
									name="grid-step"
									value={step}
									checked={stepCm === step}
									onChange={() => setGridStepCm(step as GridStepCm)}
								/>
								<span>{step} cm</span>
							</label>
						))}
					</fieldset>
					{tooFine ? (
						<p className="grid-step__foot">
							Too fine here — dots at {Math.round(visibleCm)} cm.
						</p>
					) : null}
				</div>
			) : null}
		</span>
	);
}
