import { ETeamState } from "../enum"

const teamNames = ["Enemies", "Allies", "Your hero"]

export function CreateTeamSelect(
	node: Menu.Node,
	defaultValue: ETeamState[] = [ETeamState.Enemy, ETeamState.Ally, ETeamState.Local]
) {
	const selection = node.AddMultiSelect(
		"Team",
		teamNames,
		defaultValue.map(team => teamNames[team]),
		"Show on team"
	)
	selection.IconPath = Menu.Icons.ListFilter
	return selection
}

export function IsTeamSelected(entity: Unit, selection: Menu.MultiSelect) {
	if (entity.IsMyHero) {
		return selection.IsSelected(ETeamState.Local)
	}
	return selection.IsSelected(entity.IsEnemy() ? ETeamState.Enemy : ETeamState.Ally)
}

/**
 * The sides the dropdown this row replaced stood for, by the index it saved. The order is the
 * order of the enum its readers switched the saved index on - everyone, everyone but your own
 * hero, enemies, allies but not your hero, allies and your hero - so every one of them is a
 * tick or two of the row that took its place.
 */
const storedTeams: readonly ETeamState[][] = [
	[ETeamState.Enemy, ETeamState.Ally, ETeamState.Local],
	[ETeamState.Enemy, ETeamState.Ally],
	[ETeamState.Enemy],
	[ETeamState.Ally],
	[ETeamState.Ally, ETeamState.Local]
]

/** The options the tabs' own dropdown listed, under the index each saved. */
const storedOptions: readonly string[] = [
	"All",
	"All except local",
	"Only enemies",
	"Only allies",
	"Only allies and local"
]

/**
 * The same for the modifier categories, which offered four of the five under labels of their
 * own. The labels did not describe what the indexes behind them did - "Allies" there saved the
 * index the readers answered with enemies - so they are carried by index, like every other row.
 */
const storedCategoryOptions: readonly string[] = [
	"All",
	"Enemies",
	"Allies",
	"Allies and local"
]

/** The ticks a multiselect stores for the option the dropdown was left on. */
function teamTicks(index: number): [string, boolean][] {
	const selected = storedTeams[index]
	return teamNames.map((name, team): [string, boolean] => [
		name,
		selected.includes(team)
	])
}

/** The index a dropdown saved for the option a hotkey or a logic rule captured by name. */
function indexOfOption(option: string): number {
	const index = storedOptions.indexOf(option)
	return index !== -1 ? index : storedCategoryOptions.indexOf(option)
}

/** The rows a stored config keeps under a node, or nothing when the value is not a node. */
export function StoredNode(value: unknown): Nullable<MenuSDK.ConfigObject> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as MenuSDK.ConfigObject)
		: undefined
}

/**
 * Turns the team row of a node saved as a dropdown index into the ticks the multiselect now in
 * its place stores, its hotkeys and logic rules along with it - each of those held the name of
 * one option and now holds the names of the sides it stood for. A row already saved as ticks is
 * left as it is, and so is one saved on an index the dropdown never had: it falls back to the
 * row's own default.
 */
export function MigrateTeamRow(node: Nullable<MenuSDK.ConfigObject>): void {
	if (node === undefined) {
		return
	}
	const holder = StoredNode(node.Team)
	const value = holder === undefined ? node.Team : holder.v
	if (typeof value !== "number" || storedTeams[value] === undefined) {
		return
	}
	if (holder === undefined) {
		node.Team = teamTicks(value)
		return
	}
	holder.v = teamTicks(value)
	for (const key of ["hotkeys", "logic"]) {
		const drivers = holder[key]
		if (!Array.isArray(drivers)) {
			continue
		}
		for (const driver of drivers) {
			const record = StoredNode(driver)
			const option = record?.value
			if (record === undefined || typeof option !== "string") {
				continue
			}
			const sides = storedTeams[indexOfOption(option)] ?? []
			record.value = sides.map(team => teamNames[team])
		}
	}
}
