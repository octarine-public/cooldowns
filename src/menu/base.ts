import { Menu } from "github.com/octarine-public/wrapper/index"

interface IBaseBaseMenu {
	node: Menu.Node
	nodeName: string
	defaultSize?: number
	defaultState?: boolean
	tooltip?: string
	texture?: string
	iconRound?: number
}

export class BaseMenu {
	public readonly Tree: Menu.Node
	public readonly Size: Menu.Slider
	public readonly State: Menu.Toggle

	constructor(options: IBaseBaseMenu) {
		this.Tree = options.node.AddNode(
			options.nodeName,
			options.texture,
			options.tooltip,
			options.iconRound ?? -1
		)
		this.State = this.Tree.AddToggle("State", options.defaultState ?? true)
		this.Size = this.Tree.AddSlider(
			"Additional size",
			options.defaultSize ?? 0,
			0,
			20
		)
	}

	public ResetSettings() {
		this.Size.value = this.Size.defaultValue
		this.State.value = this.State.defaultValue
		this.Tree.Update()
	}
}
