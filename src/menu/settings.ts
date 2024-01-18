import {
	GUIInfo,
	ImageData,
	Menu,
	Vector2
} from "github.com/octarine-public/wrapper/index"

interface IBaseSettingsMenu {
	node: Menu.Node
	nodeName: string
	isItem: boolean
	defaultState?: boolean
	texture?: string
	round?: number
	tooltip?: string
	defaultX?: number
	defaultY?: number
}

export abstract class BaseSettingsMenu {
	public readonly State: Menu.Toggle
	public readonly PositionX: Menu.Slider
	public readonly PositionY: Menu.Slider

	protected readonly Tree: Menu.Node

	constructor(private readonly options: IBaseSettingsMenu) {
		this.Tree = options.node.AddNode(
			options.nodeName,
			options.texture,
			options.tooltip,
			options.round ?? -1
		)

		options.defaultX ??= 0
		options.defaultY ??= options.isItem ? -40 : -10

		this.Tree.SortNodes = false
		this.State = this.Tree.AddToggle("State", options.defaultState ?? true)

		this.PositionX = this.Tree.AddSlider("Position: X", options.defaultX, -50, 150)
		this.PositionY = this.Tree.AddSlider("Position: Y", options.defaultY, -100, 150)
	}

	public get Position() {
		return new Vector2(
			GUIInfo.ScaleWidth(this.PositionX.value),
			GUIInfo.ScaleHeight(this.PositionY.value)
		)
	}

	public MenuChanged(callback: () => void) {
		this.State.OnValue(() => callback())
	}

	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = this.options.isItem ? -40 : -10
	}
}

/**
 * @description Offset & State from Creeps
 */
export class CreepSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, isItem = false) {
		super({
			node,
			isItem,
			nodeName: "Creeps",
			defaultState: false,
			texture: ImageData.Paths.Icons.icon_svg_creep
		})
	}
	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = 0
	}
}

/**
 * @description Offset & State from Bears
 */
export class BearSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly isItem = false
	) {
		super({
			node,
			isItem,
			round: 0,
			nodeName: "Bear",
			defaultY: isItem ? -32 : -3,
			texture: ImageData.GetBearTexture()
		})
	}
	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = this.isItem ? -32 : -3
	}
}

/**
 * @description Offset & State from Couriers
 */
export class CourierSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly isItem = false
	) {
		super({
			node,
			isItem,
			defaultState: isItem,
			defaultY: isItem ? -25 : 4,
			nodeName: "npc_dota_courier",
			texture: ImageData.Paths.Icons.icon_svg_courier
		})
	}
	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = this.isItem ? -25 : 4
	}
}

/**
 * @description Offset & State from Heroes
 */
export class HeroSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, isItem = false) {
		super({
			node,
			isItem,
			nodeName: "Heroes",
			texture: "menu/icons/juggernaut.svg"
		})
	}
}

/**
 * @description Offset & State from Roshans
 */
export class RoshanSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly isItem = false
	) {
		super({
			node,
			isItem,
			defaultY: isItem ? -35 : -6,
			nodeName: "npc_dota_roshan",
			texture: ImageData.Paths.Icons.icon_roshan
		})
	}
	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = this.isItem ? -35 : -6
	}
}

/**
 * @description Offset & State from Familiars
 */
export class FamiliarSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, isItem = false) {
		super({
			node,
			isItem,
			round: 0,
			defaultY: -3,
			nodeName: "Familiars",
			texture: ImageData.GetHeroTexture("npc_dota_visage_familiar")
		})
	}
	public ResetSettings() {
		this.PositionX.value = this.PositionX.defaultValue
		this.PositionY.value = -3
	}
}
