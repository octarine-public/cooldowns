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

	public readonly ModeImage: Menu.Dropdown
	private readonly modeImageNames = ["Square", "Circle"]

	constructor(node: Menu.Node) {
		super({ node, nodeName: "Items" })
		this.Tree.SortNodes = false
		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames)
		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Item)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Item)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Item)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Item)
	}

	public MenuChanged(callback: () => void) {
		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}

	public ResetSettings(callback: () => void) {
		super.ResetSettings(callback)
		this.Hero.ResetSettings(callback)
		this.Roshan.ResetSettings(callback)
		this.Courier.ResetSettings(callback)
		this.SpiritBear.ResetSettings(callback)
	}
}
