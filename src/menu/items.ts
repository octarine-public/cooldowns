import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "./base"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	HeroSettingsMenu,
	RoshanSettingsMenu
} from "./settings"

export class ItemMenu extends BaseMenu {
	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu

	constructor(node: Menu.Node) {
		super({
			node,
			nodeName: "Items",
			texture: ImageData.Paths.Icons.icon_svg_hamburger
		})

		this.Tree.SortNodes = false

		this.Hero = new HeroSettingsMenu(this.Tree, true)
		this.Roshan = new RoshanSettingsMenu(this.Tree, true)
		this.Courier = new CourierSettingsMenu(this.Tree, true)
		this.SpiritBear = new BearSettingsMenu(this.Tree, true)
	}

	public IsSpellMenu<T extends BaseMenu>(menu: BaseMenu): menu is T {
		return false
	}

	public MenuChanged(callback: () => void) {
		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}

	public ResetSettings() {
		super.ResetSettings()
		this.Hero.ResetSettings()
		this.Roshan.ResetSettings()
		this.Courier.ResetSettings()
		this.SpiritBear.ResetSettings()
	}
}