import { EMenuType } from "../enum"
import { CooldownIcons } from "./icons"

interface IBaseSettingsMenu {
	node: Menu.Node
	nodeName: string
	mType: EMenuType
	texture: string
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

	public readonly Tree: Menu.Node

	constructor(private readonly options: IBaseSettingsMenu) {
		// a settings row rather than a fold: the unit's switch rides the row and
		// the gear beside it opens the offsets, so a tab stays one flat card
		this.Tree = options.node.AddSettings(
			options.nodeName,
			options.texture,
			options.tooltip
		)
		// below the rows the whole element shares, in tabs that sort their own
		this.Tree.Priority = 1

		this.Tree.SortNodes = false
		this.State = this.Tree.AddToggle("State", this.defaultState)
		this.Tree.HeaderControl = this.State

		this.PositionX = this.Tree.AddSlider("Position: X", this.defaultX, -250, 250)
		this.PositionX.IconPath = Menu.Icons.ArrowRight
		this.PositionY = this.Tree.AddSlider("Position: Y", this.defaultY, -250, 250)
		this.PositionY.IconPath = Menu.Icons.ArrowUpDown
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
			texture: CooldownIcons.Creeps
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
			nodeName: "Bear",
			texture: CooldownIcons.Bear,
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
			texture: CooldownIcons.Courier,
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
			texture: CooldownIcons.Heroes,
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
			texture: CooldownIcons.Roshan,
			defaultX: {
				[EMenuType.Item]: 0,
				[EMenuType.Spell]: 0,
				[EMenuType.Modifier]: 4
			},
			defaultY: {
				[EMenuType.Item]: -39,
				[EMenuType.Spell]: -14,
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
			nodeName: "Familiars",
			texture: CooldownIcons.Familiars,
			defaultY: {
				[EMenuType.Spell]: 1,
				[EMenuType.Modifier]: 15
			}
		})
	}
}

/**
 * @description Offset & State from Pandas
 */
export class PandasSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, mType = EMenuType.Spell) {
		super({
			node,
			mType,
			nodeName: "Pandas",
			texture: CooldownIcons.Pandas,
			defaultY: {
				[EMenuType.Spell]: 1,
				[EMenuType.Modifier]: 15
			}
		})
	}
}
