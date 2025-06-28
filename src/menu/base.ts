import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"

interface IBaseBaseMenu {
	node: Menu.Node
	nodeName: string
	defaultSize?: number
	defaultState?: boolean
	tooltip?: string
	texture?: string
	iconRound?: number
	defaultTeamState?: ETeamState
}

export class BaseMenu {
	public readonly Tree: Menu.Node
	public readonly State: Menu.Toggle
	public readonly Size: Menu.Slider
	public readonly Rounding: Menu.Slider
	public readonly TeamState: Menu.Dropdown

	constructor(options: IBaseBaseMenu) {
		this.Tree = options.node.AddNode(
			options.nodeName,
			options.texture ?? ImageData.Icons.icon_svg_hamburger,
			options.tooltip,
			options.iconRound ?? -1
		)
		this.Tree.SortNodes = false
		this.State = this.Tree.AddToggle("State", options.defaultState ?? true)
		this.TeamState = this.Tree.AddDropdown(
			"Team",
			["All", "Only enemies", "Only allies", "Only allies and local", "Anyone but local"],
			options.defaultTeamState ?? ETeamState.Enemy,
			"Show on team"
		)
		this.Size = this.Tree.AddSlider(
			"Additional size",
			options.defaultSize ?? 0,
			0,
			20
		)
		this.Rounding = this.Tree.AddSlider("Rounding", 0, 0, 10)
	}
}
