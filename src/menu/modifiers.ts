import { Menu } from "github.com/octarine-public/wrapper/index"

import { BaseMenu } from "./base"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	FamiliarSettingsMenu,
	HeroSettingsMenu,
	RoshanSettingsMenu
} from "./settings"

export class ModifierMenu extends BaseMenu {
	public readonly ModeImage: Menu.Dropdown
	private readonly modeImageNames = ["Square", "Circle"]

	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu

	constructor(node: Menu.Node) {
		super({ node, nodeName: "Modifiers" })

		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames)
		this.Hero = new HeroSettingsMenu(this.Tree)
		this.Roshan = new RoshanSettingsMenu(this.Tree)
		this.Familiar = new BearSettingsMenu(this.Tree)
		this.Courier = new CourierSettingsMenu(this.Tree)
		this.SpiritBear = new BearSettingsMenu(this.Tree)
	}

	public MenuChanged(callback: () => void) {
		this.ModeImage.OnValue(() => callback())

		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.Familiar.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}

	public ResetSettings() {
		super.ResetSettings()
		this.Hero.ResetSettings()
		this.Roshan.ResetSettings()
		this.Courier.ResetSettings()
		this.Familiar.ResetSettings()
		this.SpiritBear.ResetSettings()
		this.Size.value = this.Size.defaultValue
		this.ModeImage.SelectedID = this.ModeImage.defaultValue
	}
}
