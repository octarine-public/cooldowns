import {
	GUIInfo,
	ImageData,
	Menu,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { EMenuType } from "../enum"

interface IBaseSettingsMenu {
	node: Menu.Node
	nodeName: string
	mType: EMenuType
	texture?: string
	round?: number
	tooltip?: string
	defaultState?: {
		[EMenuType.Item]: boolean
		[EMenuType.Spell]: boolean
		[EMenuType.Modifier]: boolean
	}
	defaultY?: {
		[EMenuType.Item]?: number
		[EMenuType.Spell]: number
		[EMenuType.Modifier]: number
	}
	defaultX?: {
		[EMenuType.Item]: number
		[EMenuType.Spell]: number
		[EMenuType.Modifier]: number
	}
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

		this.Tree.SortNodes = false
		this.State = this.Tree.AddToggle("State", this.defaultState)

		//const bnd = GUIInfo.ScaleHeight(100) | 0 // bound
		//this.PositionX = this.Tree.AddSlider("Position: X", this.defaultX, -bnd, bnd)
		//this.PositionY = this.Tree.AddSlider("Position: Y", this.defaultY, -bnd, bnd)

		this.PositionX = this.Tree.AddSlider("Position: X", this.defaultX, -50, 250)
		this.PositionY = this.Tree.AddSlider("Position: Y", this.defaultY, -50, 250)
	}

	public get Position() {
		return new Vector2(
			GUIInfo.ScaleWidth(this.PositionX.value),
			GUIInfo.ScaleHeight(this.PositionY.value)
		)
	}

	protected get defaultState() {
		const options = this.options
		return options.defaultState?.[options.mType] ?? true
	}

	protected get defaultX() {
		const options = this.options
		return options.defaultX?.[options.mType] ?? 0
	}

	protected get defaultY() {
		const options = this.options
		return options.defaultY?.[options.mType] ?? 0
	}

	public MenuChanged(callback: () => void) {
		this.State.OnValue(() => callback())
	}
}

/**
 * @description Offset & State from Creeps
 */
export class CreepSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			nodeName: "Creeps",
			texture: ImageData.Paths.Icons.icon_svg_creep
		})
	}

	protected get defaultState() {
		return false
	}
}

/**
 * @description Offset & State from Bears
 */
export class BearSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			round: 0,
			nodeName: "Bear",
			texture: ImageData.GetBearTexture(),
			defaultY: {
				[EMenuType.Item]: -32,
				[EMenuType.Spell]: -6,
				[EMenuType.Modifier]: 19
			}
		})
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}

/**
 * @description Offset & State from Couriers
 */
export class CourierSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			nodeName: "npc_dota_courier",
			texture: ImageData.Paths.Icons.icon_svg_courier,
			defaultState: {
				[EMenuType.Item]: true,
				[EMenuType.Spell]: false,
				[EMenuType.Modifier]: true
			},
			defaultY: {
				[EMenuType.Item]: 0,
				[EMenuType.Spell]: 4,
				[EMenuType.Modifier]: 13
			}
		})
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}

/**
 * @description Offset & State from Heroes
 */
export class HeroSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			nodeName: "Heroes",
			texture: "menu/icons/juggernaut.svg",
			defaultY: {
				[EMenuType.Item]: -32,
				[EMenuType.Spell]: -6,
				[EMenuType.Modifier]: 19
			}
		})
	}
}

/**
 * @description Offset & State from Roshans
 */
export class RoshanSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			nodeName: "npc_dota_roshan",
			texture: ImageData.Paths.Icons.icon_roshan,
			defaultX: {
				[EMenuType.Item]: 0,
				[EMenuType.Spell]: 0,
				[EMenuType.Modifier]: 4
			},
			defaultY: {
				[EMenuType.Item]: -33,
				[EMenuType.Spell]: -6,
				[EMenuType.Modifier]: 15
			}
		})
	}
}

/**
 * @description Offset & State from Familiars
 */
export class FamiliarSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			round: 0,
			nodeName: "Familiars",
			texture: ImageData.GetHeroTexture("npc_dota_visage_familiar"),
			defaultY: {
				[EMenuType.Spell]: 1,
				[EMenuType.Modifier]: 15
			}
		})
	}
}

/**
 * @description Offset & State from Familiars
 */
export class PandasSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			round: 0,
			nodeName: "Pandas",
			texture: ImageData.GetHeroTexture("npc_dota_brewmaster_void"),
			defaultY: {
				[EMenuType.Spell]: 1,
				[EMenuType.Modifier]: 15
			}
		})
	}
}
