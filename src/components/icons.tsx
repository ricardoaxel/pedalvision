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

/** Space-warning triangle (info panel band + canvas context). */
export function WarningIcon({
	size = 16,
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 4.5 21 19H3z" />
			<path d="M12 10v4" />
			<path d="M12 16.6v.01" />
		</svg>
	);
}

/** Download / export — the P3-01 toolbar trigger + primary action. */
export function DownloadIcon({
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 3v12" />
			<path d="M7.5 10.5 12 15l4.5-4.5" />
			<path d="M4 19h16" />
		</svg>
	);
}

/** Chevron — the mobile info-sheet expand/collapse affordance. */
export function ChevronIcon({
	size = 18,
	strokeWidth = 2,
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}

/** Scene / sheet-stack glyph — the always-visible scene plate. */
export function SceneIcon({
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M7 4.5h10a2 2 0 0 1 2 2V18" opacity="0.5" />
			<rect x="4" y="6.5" width="12" height="14" rx="2" />
			<path d="M7 11h6M7 14.5h6" />
		</svg>
	);
}

export function PencilIcon({
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
			<path d="M13.5 6.5l4 4" />
		</svg>
	);
}

export function TrashIcon({
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 7h16" />
			<path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
			<path d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12" />
			<path d="M10 11v6M14 11v6" opacity="0.6" />
		</svg>
	);
}

export function CheckIcon({
	size = 18,
	strokeWidth = 2,
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
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12.5l4.5 4.5L19 7" />
		</svg>
	);
}

export function CloseIcon({
	size = 18,
	strokeWidth = 2,
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
			<path d="M6 6l12 12M18 6 6 18" />
		</svg>
	);
}
