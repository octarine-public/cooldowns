import { ETeamState } from "../enum"
import { PreviewHero } from "./heroes"

/** The rows of the preview's unit picker, in the order the dropdown declares them. */
export const enum EPreviewUnit {
	Hero,
	SpiritBear,
	Courier,
	Roshan,
	Familiar,
	Panda,
	Creep
}

/**
 * One row of that picker as the stage needs it: the unit the row stands, by the name the game's
 * own data knows it under, and the model that data named the day this was written.
 *
 * Both, because the two answer at different times. The name is the truthful one — a unit that is
 * given a new model is shown in it without anyone here noticing — but the data behind it is
 * loaded when the script joins a server, and the menu is read in the dashboard as often as in a
 * match. The path is what the card shows until then.
 */
interface PreviewUnitModel {
	readonly unit: string
	readonly model: string
}

/**
 * The unit each row shows. The hero row is whichever hero the card is dressed for — the page
 * hands it in — so its entry here is only what stands until one is chosen.
 *
 * The summons are named at their first level: every later one includes its keys from that one,
 * so the model is the same whichever is picked.
 */
const UNITS: readonly PreviewUnitModel[] = [
	{
		unit: "npc_dota_hero_void_spirit",
		model: "models/heroes/void_spirit/void_spirit.vmdl"
	},
	{
		unit: "npc_dota_lone_druid_bear1",
		model: "models/heroes/lone_druid/spirit_bear.vmdl"
	},
	{
		unit: "npc_dota_courier",
		model: "models/props_gameplay/donkey.vmdl"
	},
	{
		unit: "npc_dota_roshan",
		model: "models/creeps/roshan/roshan.vmdl"
	},
	{
		unit: "npc_dota_visage_familiar1",
		model: "models/heroes/visage/visage_familiar.vmdl"
	},
	{
		unit: "npc_dota_brewmaster_earth_1",
		model: "models/heroes/brewmaster/brewmaster_earthspirit.vmdl"
	},
	{
		unit: "npc_dota_creep_badguys_melee",
		model: "models/creeps/lane_creeps/creep_bad_melee/creep_bad_melee.vmdl"
	}
]

/**
 * The lane creep of the other side, which the last row shows while the card is dressed for a
 * friendly unit. It is the one subject here whose look IS the side it fights for: everything
 * else — a courier, a bear, Roshan — is the same body whoever it belongs to, and swapping it
 * with the team picker would say something about the game that is not true.
 */
const RADIANT_CREEP: PreviewUnitModel = {
	unit: "npc_dota_creep_goodguys_melee",
	model: "models/creeps/lane_creeps/creep_radiant_melee/radiant_melee.vmdl"
}

/** What a unit that wears nothing wears, handed out rather than minted every frame. */
const EMPTY: readonly string[] = []

/** Which row of the picker a unit index stands, dressed for the side the card is showing. */
function entryOf(unit: number, team: ETeamState): Nullable<PreviewUnitModel> {
	return unit === EPreviewUnit.Creep && team !== ETeamState.Enemy
		? RADIANT_CREEP
		: UNITS[unit]
}

/** The model the stage stands for a row of the picker, dressed for the side it is showing. */
export function PreviewModel(
	unit: number,
	team: ETeamState,
	hero: PreviewHero
): Nullable<string> {
	if (unit === EPreviewUnit.Hero) {
		return hero.model
	}
	const entry = entryOf(unit, team)
	if (entry === undefined) {
		return undefined
	}
	const named = UnitData.GetUnitDataByName(entry.unit)?.ModelName
	return named !== undefined && named !== "" ? named : entry.model
}

/**
 * What that unit wears on top of it, worn on its skeleton rather than hung off it: a Dota
 * wearable is skinned to the hero's own rig and carries none of his animations, so the pose that
 * drives it is his. Everything but a hero is one whole model and wears nothing.
 */
export function PreviewWearables(
	unit: number,
	team: ETeamState,
	hero: PreviewHero
): readonly string[] {
	return unit === EPreviewUnit.Hero ? (hero.worn ?? EMPTY) : EMPTY
}
