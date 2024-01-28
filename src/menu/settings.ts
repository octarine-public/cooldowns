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
	menuType: EMenuType
	texture?: string
	round?: number
	tooltip?: string
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
		this.State = this.Tree.AddToggle("State", this.defaultState ?? true)

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

	protected get defaultState(): boolean {
		return true
	}

	protected get defaultX(): number {
		return 0
	}

	protected get defaultY(): number {
		switch (this.options.menuType) {
			case EMenuType.Item:
				return -39
			case EMenuType.Spell:
				return -8
			case EMenuType.Modifier:
				return 41
			default:
				return 0
		}
	}

	public abstract ResetSettings(callback: () => void): void

	public MenuChanged(callback: () => void) {
		this.State.OnValue(() => callback())
	}
}

/**
 * @description Offset & State from Creeps
 */
export class CreepSettingsMenu extends BaseSettingsMenu {
	constructor(node: Menu.Node, menuType = EMenuType.Spell) {
		super({
			node,
			menuType,
			nodeName: "Creeps",
			texture: ImageData.Paths.Icons.icon_svg_creep
		})
	}

	protected get defaultState() {
		return false
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}

/**
 * @description Offset & State from Bears
 */
export class BearSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly menuType = EMenuType.Spell
	) {
		super({
			node,
			menuType,
			round: 0,
			nodeName: "Bear",
			texture: ImageData.GetBearTexture()
		})
	}

	protected get defaultY() {
		switch (this.menuType) {
			case EMenuType.Item:
				return -32
			case EMenuType.Spell:
				return -6
			case EMenuType.Modifier:
				return 19
			default:
				return 0
		}
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
	constructor(
		node: Menu.Node,
		private readonly menuType = EMenuType.Spell
	) {
		super({
			node,
			menuType,
			nodeName: "npc_dota_courier",
			texture: ImageData.Paths.Icons.icon_svg_courier
		})
	}

	protected get defaultState() {
		switch (this.menuType) {
			case EMenuType.Item:
			case EMenuType.Modifier:
				return true
			default:
				return false
		}
	}

	protected get defaultX() {
		return 0
	}

	protected get defaultY() {
		switch (this.menuType) {
			case EMenuType.Item:
				return 32
			case EMenuType.Spell:
				return 4
			case EMenuType.Modifier:
				return 32
			default:
				return 0
		}
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
	constructor(
		node: Menu.Node,
		private readonly menuType = EMenuType.Spell
	) {
		super({
			node,
			menuType,
			nodeName: "Heroes",
			texture: "menu/icons/juggernaut.svg"
		})
	}

	protected get defaultY() {
		switch (this.menuType) {
			case EMenuType.Item:
				return -32
			case EMenuType.Spell:
				return -6
			case EMenuType.Modifier:
				return 19
			default:
				return 0
		}
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}

/**
 * @description Offset & State from Roshans
 */
export class RoshanSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly menuType = EMenuType.Spell
	) {
		super({
			node,
			menuType,
			nodeName: "npc_dota_roshan",
			texture: ImageData.Paths.Icons.icon_roshan
		})
	}

	protected get defaultX() {
		switch (this.menuType) {
			case EMenuType.Modifier:
				return 58
			default:
				return 0
		}
	}
	protected get defaultY() {
		switch (this.menuType) {
			case EMenuType.Item:
				return -25
			case EMenuType.Spell:
				return 3
			case EMenuType.Modifier:
				return 10
			default:
				return 0
		}
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}

/**
 * @description Offset & State from Familiars
 */
export class FamiliarSettingsMenu extends BaseSettingsMenu {
	constructor(
		node: Menu.Node,
		private readonly menuType = EMenuType.Spell
	) {
		super({
			node,
			menuType,
			round: 0,
			nodeName: "Familiars",
			texture: ImageData.GetHeroTexture("npc_dota_visage_familiar")
		})
	}

	protected get defaultY() {
		switch (this.menuType) {
			case EMenuType.Spell:
				return 1
			case EMenuType.Modifier:
				return 15
			default:
				return 0
		}
	}

	public ResetSettings(callback: () => void): void {
		this.State.value = this.defaultState
		this.PositionX.value = this.defaultX
		this.PositionY.value = this.defaultY
		callback()
	}
}
