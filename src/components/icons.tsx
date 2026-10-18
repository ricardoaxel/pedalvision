/**
 * Shared inline SVG glyphs (20px default, currentColor). One source for the
 * pedal / board / plus icons used by the toolbar (`App.tsx`) and the picker
 * (`Picker.tsx`) so they can't drift apart.
 */
interface IconProps {
	size?: number;
	strokeWidth?: number;
	className?: string;
}

export function PedalIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<circle cx="9.5" cy="8" r="1.4" />
			<circle cx="14.5" cy="8" r="1.4" />
			<path d="M9.5 13h5" />
		</svg>
	);
}

export function BoardIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<rect x="2.5" y="7" width="19" height="10" rx="2" />
			<path d="M6 7v10M18 7v10" opacity="0.5" />
		</svg>
	);
}

export function PlusIcon({
	size = 12,
	strokeWidth = 2.4,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M12 5v14M5 12h14" />
		</svg>
	);
}

/** "Build your own" — used by the Custom tab (sliders/equalizer glyph). */
export function CustomIcon({
	size = 20,
	strokeWidth = 1.8,
	className,
}: IconProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
			<circle cx="15" cy="7" r="2" />
			<circle cx="9" cy="17" r="2" />
		</svg>
	);
}
