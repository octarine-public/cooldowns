import { Menu } from "github.com/octarine-public/wrapper/index"

export class BaseMenu {
	public readonly Tree: Menu.Node
	public readonly State: Menu.Toggle

	constructor(
		node: Menu.Node,
		nodeName: string,
		defaultState = false,
		tooltip?: string,
		icon?: string,
		iconRound = -1
	) {
		this.Tree = node.AddNode(nodeName, icon, tooltip, iconRound)
		this.State = this.Tree.AddToggle("State", defaultState)
	}
}
