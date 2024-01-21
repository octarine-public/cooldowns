import { Menu } from "github.com/octarine-public/wrapper/index"

import { EMenuType } from "../enum"
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
	public readonly ModePosition: Menu.Dropdown

	private readonly modeImageNames = ["Square", "Circle"]
	private readonly positionNames = ["Vertical", "Horizontal"]

	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu

	constructor(node: Menu.Node) {
		super({ node, nodeName: "Modifiers" })

		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames)
		this.ModePosition = this.Tree.AddDropdown("Position", this.positionNames)

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Familiar = new FamiliarSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Modifier)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Modifier)
	}

	public MenuChanged(callback: () => void) {
		this.ModeImage.OnValue(() => callback())
		this.ModePosition.OnValue(() => callback())

		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.Familiar.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}

	public ResetSettings(callback: () => void) {
		super.ResetSettings(callback)
		this.Hero.ResetSettings(callback)
		this.Roshan.ResetSettings(callback)
		this.Courier.ResetSettings(callback)
		this.Familiar.ResetSettings(callback)
		this.SpiritBear.ResetSettings(callback)
		this.Size.value = this.Size.defaultValue
		this.ModeImage.SelectedID = this.ModeImage.defaultValue
	}
}
