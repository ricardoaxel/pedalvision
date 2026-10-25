import { z } from "zod";
import {
	CONFIDENCE_LEVELS,
	EFFECT_TYPES,
	HTTP_URL,
	ID_PATTERN,
	IMAGE_FORMATS,
	ISO_DATE_PATTERN,
	JACK_EDGES,
	JACK_KINDS,
	PEDAL_STATUSES,
	SourceRefSchema,
	USAGE_TYPES,
} from "./schema.ts";

/**
 * Raw research archive schema (P5-01, docs/catalog/raw-research-record.md).
 *
 * The raw record is a **superset** of the runtime catalog: it keeps every
 * verified fact, connector, image candidate and source page found during the
 * same base research pass, including fields the app does not display yet. The
 * runtime catalog (`src/catalog/data/*.json`) is a projection — never the
 * research source of truth. Later schema/UI additions map from these files
 * instead of re-researching a model.
 *
 * Archive layout:
 *   data/catalog/research/pedals/<brand>/<batch>.json  (RawPedalBatchSchema)
 *   data/catalog/research/boards/<brand>/<batch>.json  (RawBoardBatchSchema)
 *
 * `extra` is the home for any other verified fact so the archive never has to
 * drop information just because the schema has no field yet.
 */

export const RAW_DEVICE_TYPES = [
	"stompbox",
	"multi-fx",
	"amp-modeler",
	"preamp",
	"di",
	"power-supply",
	"switcher",
	"controller",
	"interface",
	"other",
] as const;

export const RAW_FORM_FACTORS = [
	"compact",
	"standard",
	"double",
	"mini",
	"desktop",
	"rack",
	"expression",
	"other",
] as const;

export const RAW_INSTRUMENT_TYPES = [
	"guitar",
	"bass",
	"synth",
	"keys",
	"vocal",
	"other",
] as const;

/** Physical connector type (ADR-003 §Optional metadata). */
export const RAW_CONNECTOR_TYPES = [
	"ts",
	"trs",
	"xlr",
	"din5",
	"trs-midi-a",
	"trs-midi-b",
	"usb-a",
	"usb-b",
	"usb-c",
	"micro-usb",
	"mini-usb",
	"barrel",
	"iec",
	"rca",
	"3.5mm",
	"other",
] as const;

export const RAW_SIGNALS = [
	"audio",
	"midi",
	"control",
	"power",
	"usb",
	"digital-audio",
] as const;

export const RAW_LEVELS = [
	"instrument",
	"line",
	"speaker",
	"headphone",
] as const;
export const RAW_MIDI_TYPES = ["a", "b", "din5", "usb"] as const;
export const RAW_USB_FUNCTIONS = [
	"audio",
	"midi",
	"editor",
	"firmware",
	"power",
	"charging",
	"host",
] as const;
export const RAW_DIN5_MODES = [
	"none",
	"in",
	"out",
	"thru",
	"in-out",
	"out-thru",
	"in-out-thru",
] as const;
export const RAW_TRS_MIDI_MODES = ["none", "a", "b"] as const;
export const RAW_CIRCUIT_TYPES = ["analog", "digital", "hybrid"] as const;
export const RAW_BYPASS_TYPES = [
	"true",
	"buffered",
	"relay",
	"electronic",
	"none",
] as const;
export const RAW_BOARD_TYPES = [
	"flat",
	"angled",
	"tiered",
	"folding",
	"other",
] as const;
export const RAW_BOARD_SURFACES = [
	"velcro",
	"loop",
	"slat",
	"track",
	"other",
] as const;
export const RAW_ARTIST_ROLES = [
	"signature",
	"endorsed",
	"used-by",
	"designed-with",
] as const;
export const RAW_PRICE_CONDITIONS = ["new", "used"] as const;
export const RAW_POLARITIES = ["center-negative", "center-positive"] as const;
export const RAW_VIDEO_KINDS = [
	"official-demo",
	"manufacturer",
	"manual",
	"review",
	"other",
] as const;

const PositiveNumber = z.number().positive();
const NonNegativeNumber = z.number().nonnegative();
const IsoDate = z.string().regex(ISO_DATE_PATTERN, "must be YYYY-MM-DD");
const NumberOrBands = z.union([z.number(), z.record(z.string(), z.number())]);

/** A loose nested section: known fields are typed, extra facts stay allowed. */
const section = <T extends z.ZodRawShape>(shape: T) =>
	z.object(shape).catchall(z.unknown());

export const RawSerialSchema = section({
	format: z.string().min(1).optional(),
	ranges: z
		.array(
			section({
				from: z.string().optional(),
				to: z.string().optional(),
				year: z.number().int().min(1900).max(2100).optional(),
				revision: z.string().optional(),
			}),
		)
		.optional(),
	location: z.string().optional(),
	notes: z.string().optional(),
});

export const RawArtistAssociationSchema = section({
	artist: z.string().min(1),
	role: z.enum(RAW_ARTIST_ROLES),
	notes: z.string().optional(),
	sources: z.array(SourceRefSchema).optional(),
});

export const RawPriceObservationSchema = section({
	amount: NonNegativeNumber,
	currency: z.string().min(1),
	condition: z.enum(RAW_PRICE_CONDITIONS),
	source: z.string().min(1),
	observedAt: IsoDate,
	notes: z.string().optional(),
});

export const RawVideoSchema = section({
	url: HTTP_URL,
	title: z.string().min(1),
	source: z.string().min(1),
	kind: z.enum(RAW_VIDEO_KINDS),
	verified: z.boolean(),
});

export const RawImageCandidateSchema = section({
	url: HTTP_URL,
	sourcePage: HTTP_URL.optional(),
	priority: z.number().int().positive(),
	notes: z.string().optional(),
});

export const RawJackSchema = section({
	label: z.string().min(1).optional(),
	kind: z.enum(JACK_KINDS),
	edge: z.enum(JACK_EDGES).optional(),
	pos: z.number().min(0).max(1).optional(),
	xCm: NonNegativeNumber.optional(),
	yCm: NonNegativeNumber.optional(),
	approximate: z.boolean().optional(),
	connector: z.enum(RAW_CONNECTOR_TYPES).optional(),
	channels: z.number().int().positive().optional(),
	signal: z.enum(RAW_SIGNALS).optional(),
	balanced: z.boolean().optional(),
	level: z.enum(RAW_LEVELS).optional(),
	impedanceOhm: NumberOrBands.optional(),
	maxLevelDbu: NumberOrBands.optional(),
	stereo: z.boolean().optional(),
	midiType: z.enum(RAW_MIDI_TYPES).optional(),
	usbFunctions: z.array(z.enum(RAW_USB_FUNCTIONS)).optional(),
	note: z.string().optional(),
});

export const RAW_JACK_LAYOUT_CONFIDENCES = [
	"verified",
	"estimated",
	"unknown",
] as const;

/**
 * Physical jack-layout provenance (P5 batch guardrail, 2026-10-25).
 *
 * An `edge` must be backed by a source that actually shows the connector face
 * (official rear/top photo, support page, or manual diagram). Never infer an
 * edge from a sibling model or “compact layout”. `estimated`/`unknown` batches
 * must omit the edge (the app falls back to its assumed anchors) instead of
 * shipping a guessed edge.
 */
export const RawJackLayoutSchema = section({
	source: z.string().min(1).optional(),
	confidence: z.enum(RAW_JACK_LAYOUT_CONFIDENCES).optional(),
	note: z.string().min(1).optional(),
});

export const RawPowerSchema = section({
	voltage: PositiveNumber.optional(),
	acDc: z.enum(["DC", "AC"]).optional(),
	currentMa: NonNegativeNumber.optional(),
	powerW: NonNegativeNumber.optional(),
	polarity: z.enum(RAW_POLARITIES).optional(),
	connector: z.enum(RAW_CONNECTOR_TYPES).optional(),
	connectorSize: z.string().optional(),
	battery: z.string().optional(),
	batteryLifeHours: NonNegativeNumber.optional(),
	usbBusPower: z.boolean().optional(),
	isolationRequired: z.boolean().optional(),
	inrushMa: NonNegativeNumber.optional(),
	recommendedSupply: z.string().optional(),
	outlets: z.number().int().positive().optional(),
	isolatedOutputs: z.number().int().nonnegative().optional(),
	perOutput: z
		.array(
			section({
				voltage: PositiveNumber.optional(),
				currentMa: NonNegativeNumber.optional(),
				isolated: z.boolean().optional(),
			}),
		)
		.optional(),
	totalMa: NonNegativeNumber.optional(),
	acInput: z.string().optional(),
	courtesyOutlet: z.boolean().optional(),
	sag: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawAudioSchema = section({
	inputs: z.number().int().nonnegative().optional(),
	outputs: z.number().int().nonnegative().optional(),
	channels: z.number().int().positive().optional(),
	stereo: z.boolean().optional(),
	trueStereo: z.boolean().optional(),
	balanced: z.boolean().optional(),
	level: z.enum(RAW_LEVELS).optional(),
	inputImpedanceOhm: NumberOrBands.optional(),
	outputImpedanceOhm: NumberOrBands.optional(),
	maxInputLevelDbu: NumberOrBands.optional(),
	maxOutputLevelDbu: NumberOrBands.optional(),
	nominalLevelDbu: NumberOrBands.optional(),
	gainDb: z.number().optional(),
	headroomDb: z.number().optional(),
	snrDb: z.number().optional(),
	thdPercent: NonNegativeNumber.optional(),
	frequencyResponse: z.string().optional(),
	dryThrough: z.enum(["analog", "digital", "none"]).optional(),
	headphone: z.boolean().optional(),
	auxIn: z.boolean().optional(),
	di: z.boolean().optional(),
	effectsLoop: section({
		send: z.number().int().nonnegative().optional(),
		return: z.number().int().nonnegative().optional(),
		stereo: z.boolean().optional(),
		trsInsert: z.boolean().optional(),
	}).optional(),
	fourCableMethod: z.boolean().optional(),
	groundLift: z.boolean().optional(),
	phaseInvert: z.boolean().optional(),
	phantomPower: z.boolean().optional(),
	pad: z.boolean().optional(),
	analogDryThrough: z.boolean().optional(),
	latencyMs: NumberOrBands.optional(),
	note: z.string().optional(),
});

export const RawControlSchema = section({
	expression: z.number().int().nonnegative().optional(),
	expressionVoltageRange: z.string().optional(),
	cv: z.boolean().optional(),
	cvVoltageRange: z.string().optional(),
	footswitch: z.boolean().optional(),
	footswitchType: z.string().optional(),
	tapTempo: z.boolean().optional(),
	ampSwitch: z.boolean().optional(),
	ampSwitchType: z.string().optional(),
	remote: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawMidiSchema = section({
	din5: z.enum(RAW_DIN5_MODES).optional(),
	din: z.boolean().optional(),
	trs: z.enum(RAW_TRS_MIDI_MODES).optional(),
	type: z.enum(RAW_MIDI_TYPES).optional(),
	usb: z.boolean().optional(),
	ble: z.boolean().optional(),
	clock: z.boolean().optional(),
	programChange: z.boolean().optional(),
	cc: z.boolean().optional(),
	nrpn: z.boolean().optional(),
	channels: z.number().int().positive().optional(),
	merge: z.boolean().optional(),
	thru: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawUsbSchema = section({
	connector: z.enum(RAW_CONNECTOR_TYPES).optional(),
	functions: z.array(z.enum(RAW_USB_FUNCTIONS)).optional(),
	device: z.boolean().optional(),
	host: z.boolean().optional(),
	classCompliant: z.boolean().optional(),
	audioChannels: z.string().optional(),
	sampleRateKhz: NonNegativeNumber.optional(),
	bitDepth: z.number().int().positive().optional(),
	latencyMs: NonNegativeNumber.optional(),
	busPower: z.boolean().optional(),
	loopback: z.boolean().optional(),
	reamp: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawWirelessSchema = section({
	bluetoothAudio: z.boolean().optional(),
	bluetoothControl: z.boolean().optional(),
	bluetoothVersion: z.string().optional(),
	bleMidi: z.boolean().optional(),
	wifi: z.boolean().optional(),
	proprietary: z.string().optional(),
	app: z.string().optional(),
	presets: z.number().int().nonnegative().optional(),
	banks: z.number().int().nonnegative().optional(),
	scenes: z.number().int().nonnegative().optional(),
	irSlots: z.number().int().nonnegative().optional(),
	irFormats: z.array(z.string()).optional(),
	cloud: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawCircuitSchema = section({
	type: z.enum(RAW_CIRCUIT_TYPES).optional(),
	bypass: z.enum(RAW_BYPASS_TYPES).optional(),
	switching: z.string().optional(),
	dsp: z.string().optional(),
	sampleRateKhz: NonNegativeNumber.optional(),
	bitDepth: z.number().int().positive().optional(),
	latencyMs: NonNegativeNumber.optional(),
	trails: z.boolean().optional(),
	killDry: z.boolean().optional(),
	parallel: z.boolean().optional(),
	series: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawPhysicalSchema = section({
	weightG: NonNegativeNumber.optional(),
	depthCm: PositiveNumber.optional(),
	heightCm: PositiveNumber.optional(),
	enclosure: z.string().optional(),
	finish: z.string().optional(),
	display: z.string().optional(),
	footswitches: z.number().int().nonnegative().optional(),
	expressionPedal: z.boolean().optional(),
	jackOrientation: z.string().optional(),
	powerJackLocation: z.string().optional(),
	recessedJacks: z.boolean().optional(),
	plugClearance: z.string().optional(),
	mounting: z.string().optional(),
	batteryCompartment: z.boolean().optional(),
	note: z.string().optional(),
});

export const RawElectricalSchema = section({
	inputImpedanceOhm: NumberOrBands.optional(),
	outputImpedanceOhm: NumberOrBands.optional(),
	maxInputLevelDbu: NumberOrBands.optional(),
	maxOutputLevelDbu: NumberOrBands.optional(),
	nominalLevelDbu: NumberOrBands.optional(),
	gainDb: z.number().optional(),
	headroomDb: z.number().optional(),
	snrDb: z.number().optional(),
	thdPercent: NonNegativeNumber.optional(),
	frequencyResponse: z.string().optional(),
	phantomPower: z.boolean().optional(),
	pad: z.boolean().optional(),
	groundLift: z.boolean().optional(),
	phaseInvert: z.boolean().optional(),
	trueStereo: z.boolean().optional(),
	analogDryThrough: z.boolean().optional(),
	balanced: z.boolean().optional(),
	level: z.enum(RAW_LEVELS).optional(),
	note: z.string().optional(),
});

export const RawRoutingSchema = section({
	effectsLoops: z.number().int().nonnegative().optional(),
	fourCableMethod: z.boolean().optional(),
	series: z.boolean().optional(),
	parallel: z.boolean().optional(),
	split: z.boolean().optional(),
	killDry: z.boolean().optional(),
	dryWetMix: z.boolean().optional(),
	trails: z.boolean().optional(),
	bypass: z.enum(RAW_BYPASS_TYPES).optional(),
	switching: z.string().optional(),
	latencyMs: NonNegativeNumber.optional(),
	presets: z.number().int().nonnegative().optional(),
	banks: z.number().int().nonnegative().optional(),
	scenes: z.number().int().nonnegative().optional(),
	tuner: z.boolean().optional(),
	looper: z.boolean().optional(),
	metronome: z.boolean().optional(),
	ampModeling: z.boolean().optional(),
	cabModeling: z.boolean().optional(),
	irSlots: z.number().int().nonnegative().optional(),
	irFormats: z.array(z.string()).optional(),
	expressionAssignments: z.boolean().optional(),
	snapshots: z.number().int().nonnegative().optional(),
	note: z.string().optional(),
});

export const RawOptionalSchema = section({
	connectors: z.array(RawJackSchema).optional(),
	audio: RawAudioSchema.optional(),
	control: RawControlSchema.optional(),
	midi: RawMidiSchema.optional(),
	usb: RawUsbSchema.optional(),
	wireless: RawWirelessSchema.optional(),
	circuit: RawCircuitSchema.optional(),
	physical: RawPhysicalSchema.optional(),
	electrical: RawElectricalSchema.optional(),
	routing: RawRoutingSchema.optional(),
	power: RawPowerSchema.optional(),
	lifecycle: section({
		year: z.number().int().min(1900).max(2100).optional(),
		discontinuedYear: z.number().int().min(1900).max(2100).optional(),
		replacement: z.string().optional(),
		limitedEdition: z.boolean().optional(),
		madeIn: z.string().optional(),
		manualUrl: HTTP_URL.optional(),
		firmware: z.string().optional(),
		midiChartUrl: HTTP_URL.optional(),
	}).optional(),
	note: z.string().optional(),
});

const commonMetadata = {
	year: z.number().int().min(1900).max(2100).optional(),
	status: z.enum(PEDAL_STATUSES).optional(),
	serial: RawSerialSchema.optional(),
	videos: z.array(RawVideoSchema).optional(),
	artistAssociation: z.array(RawArtistAssociationSchema).optional(),
	priceObservations: z.array(RawPriceObservationSchema).optional(),
	notes: z.string().min(1).optional(),
};

const provenance = {
	sources: z.array(SourceRefSchema).optional(),
	confidence: z.enum(CONFIDENCE_LEVELS).optional(),
	lastVerified: IsoDate.optional(),
	imageCandidates: z.array(RawImageCandidateSchema).optional(),
	extra: z.record(z.string(), z.unknown()).optional(),
};

export const RawPedalRecordSchema = z
	.object({
		id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
		brand: z.string().min(1),
		name: z.string().min(1),
		aliases: z.array(z.string().min(1)).optional(),
		category: z.enum(["pedal", "supply"]),
		deviceType: z.enum(RAW_DEVICE_TYPES).optional(),
		formFactor: z.enum(RAW_FORM_FACTORS).optional(),
		instrumentTypes: z.array(z.enum(RAW_INSTRUMENT_TYPES)).optional(),
		effectTypes: z.array(z.enum(EFFECT_TYPES)).optional(),
		widthCm: PositiveNumber,
		heightCm: PositiveNumber,
		dimensionsSource: z.string().optional(),
		/** Delivery image format for the hosted asset; default `png`. */
		imageFormat: z.enum(IMAGE_FORMATS).optional(),
		jacks: z.array(RawJackSchema).optional(),
		jackLayout: RawJackLayoutSchema.optional(),
		power: RawPowerSchema.optional(),
		io: RawAudioSchema.optional(),
		optional: RawOptionalSchema.optional(),
		usage: z.enum(USAGE_TYPES).optional(),
		color: z.string().min(1).optional(),
		variantOf: z.string().regex(ID_PATTERN).optional(),
		...commonMetadata,
		...provenance,
	})
	.strict();

export const RawBoardRecordSchema = z
	.object({
		id: z.string().regex(ID_PATTERN, "id must be a lowercase-hyphenated slug"),
		brand: z.string().min(1),
		name: z.string().min(1),
		category: z.literal("board"),
		/** Footprint width (cm). */
		widthCm: PositiveNumber,
		/** Footprint depth/front-to-back (cm); physical height is separate. */
		heightCm: PositiveNumber,
		/** Delivery image format for the hosted asset; default `png`. */
		imageFormat: z.enum(IMAGE_FORMATS).optional(),
		thicknessCm: PositiveNumber.optional(),
		maxHeightCm: PositiveNumber.optional(),
		weightG: NonNegativeNumber.optional(),
		material: z.string().optional(),
		finish: z.string().optional(),
		color: z.string().optional(),
		boardType: z.enum(RAW_BOARD_TYPES).optional(),
		tiers: z.number().int().nonnegative().optional(),
		tierHeightsCm: z.array(PositiveNumber).optional(),
		surface: z.enum(RAW_BOARD_SURFACES).optional(),
		handles: z.boolean().optional(),
		feet: z.boolean().optional(),
		mounting: z.string().optional(),
		bagIncluded: z.boolean().optional(),
		caseIncluded: z.boolean().optional(),
		caseModel: z.string().optional(),
		foldable: z.boolean().optional(),
		weightWithCaseG: NonNegativeNumber.optional(),
		powerMount: z.string().optional(),
		powerSupplySpace: z.string().optional(),
		cableRouting: z.string().optional(),
		cableClearanceCm: NonNegativeNumber.optional(),
		maxPedalHeightCm: NonNegativeNumber.optional(),
		maxPedalDepthCm: NonNegativeNumber.optional(),
		variantOf: z.string().regex(ID_PATTERN).optional(),
		...commonMetadata,
		...provenance,
	})
	.strict();

export const RawPedalBatchSchema = z.array(RawPedalRecordSchema);
export const RawBoardBatchSchema = z.array(RawBoardRecordSchema);

export type RawSerial = z.infer<typeof RawSerialSchema>;
export type RawArtistAssociation = z.infer<typeof RawArtistAssociationSchema>;
export type RawPriceObservation = z.infer<typeof RawPriceObservationSchema>;
export type RawVideo = z.infer<typeof RawVideoSchema>;
export type RawImageCandidate = z.infer<typeof RawImageCandidateSchema>;
export type RawJack = z.infer<typeof RawJackSchema>;
export type RawJackLayout = z.infer<typeof RawJackLayoutSchema>;
export type RawPower = z.infer<typeof RawPowerSchema>;
export type RawAudio = z.infer<typeof RawAudioSchema>;
export type RawControl = z.infer<typeof RawControlSchema>;
export type RawMidi = z.infer<typeof RawMidiSchema>;
export type RawUsb = z.infer<typeof RawUsbSchema>;
export type RawWireless = z.infer<typeof RawWirelessSchema>;
export type RawCircuit = z.infer<typeof RawCircuitSchema>;
export type RawPhysical = z.infer<typeof RawPhysicalSchema>;
export type RawElectrical = z.infer<typeof RawElectricalSchema>;
export type RawRouting = z.infer<typeof RawRoutingSchema>;
export type RawOptional = z.infer<typeof RawOptionalSchema>;
export type RawPedalRecord = z.infer<typeof RawPedalRecordSchema>;
export type RawBoardRecord = z.infer<typeof RawBoardRecordSchema>;
export type RawPedalBatch = z.infer<typeof RawPedalBatchSchema>;
export type RawBoardBatch = z.infer<typeof RawBoardBatchSchema>;
