import type { ReactNode } from "react";

/**
 * A titled spec-sheet section (mono eyebrow + optional right-aligned aside),
 * shared by the custom pedal creator, the custom board creator and the picker's
 * kind control so the Datasheet grammar stays in one place.
 */
export function Section({
	label,
	aside,
	children,
}: {
	label: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="custom__section">
			<div className="custom__section-head">
				<h3 className="custom__eyebrow">{label}</h3>
				{aside}
			</div>
			{children}
		</section>
	);
}
