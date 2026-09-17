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
