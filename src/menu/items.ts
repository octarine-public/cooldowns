import { Menu } from "github.com/octarine-public/wrapper/index"

import { EMenuType } from "../enum"
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
	public readonly SquareMode: Menu.Dropdown

	constructor(node: Menu.Node) {
		super({ node, nodeName: "Items" })
		this.Tree.SortNodes = false
		this.SquareMode = this.Tree.AddDropdown("Shape", ["Rectangle", "Square"])

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Item)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Item)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Item)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Item)
	}

	public MenuChanged(callback: () => void) {
		this.SquareMode.OnValue(() => callback())
		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}
}
