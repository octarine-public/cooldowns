import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

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
	public readonly State: Menu.Toggle
	public readonly Size: Menu.Slider
	public readonly Rounding: Menu.Slider

	constructor(options: IBaseBaseMenu) {
		this.Tree = options.node.AddNode(
			options.nodeName,
			options.texture ?? ImageData.Paths.Icons.icon_svg_hamburger,
			options.tooltip,
			options.iconRound ?? -1
		)
		this.Tree.SortNodes = false

		this.State = this.Tree.AddToggle("State", options.defaultState ?? true)
		this.Size = this.Tree.AddSlider(
			"Additional size",
			options.defaultSize ?? 0,
			0,
			20
		)
		this.Rounding = this.Tree.AddSlider("Rounding", 0, 0, 10)
	}

	public ResetSettings(callback: () => void) {
		this.Size.value = this.Size.defaultValue
		this.State.value = this.State.defaultValue
		this.Rounding.value = this.Rounding.defaultValue
		this.Tree.Update()
		callback()
	}
}
