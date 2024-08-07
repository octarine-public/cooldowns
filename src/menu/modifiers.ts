import { Menu } from "github.com/octarine-public/wrapper/index"

import { EMenuType, EPositionType } from "../enum"
import { BaseMenu } from "./base"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	FamiliarSettingsMenu,
	HeroSettingsMenu,
	PandasSettingsMenu,
	RoshanSettingsMenu
} from "./settings"

export class ModifierMenu extends BaseMenu {
	public readonly Charges: Menu.Toggle
	public readonly Remaining: Menu.Toggle
	public readonly ModeImage: Menu.Dropdown
	public readonly ModePosition: Menu.Dropdown

	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu
	public readonly Pandas: PandasSettingsMenu

	private readonly modeImageNames = ["Square", "Circle"]
	private readonly positionNames = ["Vertical", "Horizontal"]

	constructor(node: Menu.Node) {
		super({ node, nodeName: "Modifiers" })

		this.Rounding.IsHidden = true

		this.Charges = this.Tree.AddToggle("Charges", true, "Show charges")
		this.Remaining = this.Tree.AddToggle(
			"Remaining time",
			false,
			"Show remaining time"
		)
		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames)
		this.ModePosition = this.Tree.AddDropdown(
			"Position",
			this.positionNames,
			EPositionType.Horizontal
		)

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Familiar = new FamiliarSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Modifier)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Pandas = new PandasSettingsMenu(this.Tree, EMenuType.Modifier)
	}

	public MenuChanged(callback: () => void) {
		this.ModeImage.OnValue(() => callback())
		this.Remaining.OnValue(() => callback())
		this.ModePosition.OnValue(() => callback())

		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.Pandas.MenuChanged(callback)
		this.Familiar.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}
}
