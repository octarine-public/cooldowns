import { Color, Menu } from "github.com/octarine-public/wrapper/index"

import { EMenuType } from "../enum"
import { BaseMenu } from "./base"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	CreepSettingsMenu,
	FamiliarSettingsMenu,
	HeroSettingsMenu,
	RoshanSettingsMenu
} from "./settings"

export class SpellMenu extends BaseMenu {
	public readonly ModeImage: Menu.Dropdown
	public readonly LevelType: Menu.Dropdown
	public readonly LevelColor: Menu.ColorPicker
	public readonly ChargeColor: Menu.ColorPicker

	public readonly Hero: HeroSettingsMenu
	public readonly Creep: CreepSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu

	private readonly modeImageNames = ["Square", "Circle", "Minimalistic"]

	constructor(node: Menu.Node) {
		super({ node, defaultSize: 6, nodeName: "Spells" })
		this.Tree.SortNodes = false
		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames)
		this.LevelType = this.Tree.AddDropdown("Level type", ["Square", "Text"])
		this.LevelColor = this.Tree.AddColorPicker("Level color", Color.Yellow)
		this.ChargeColor = this.Tree.AddColorPicker("Charge color", Color.Green)

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Spell)
		this.Creep = new CreepSettingsMenu(this.Tree, EMenuType.Spell)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Spell)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Spell)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Spell)
		this.Familiar = new FamiliarSettingsMenu(this.Tree, EMenuType.Spell)
	}

	public MenuChanged(callback: () => void) {
		this.ModeImage.OnValue(() => callback())

		this.Hero.MenuChanged(callback)
		this.Creep.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.Familiar.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}

	public ResetSettings(callback: () => void) {
		super.ResetSettings(callback)
		this.Hero.ResetSettings(callback)
		this.Creep.ResetSettings(callback)
		this.Roshan.ResetSettings(callback)
		this.Courier.ResetSettings(callback)
		this.Familiar.ResetSettings(callback)
		this.SpiritBear.ResetSettings(callback)

		this.Size.value = this.Size.defaultValue
		this.LevelType.SelectedID = this.LevelType.defaultValue
		this.ModeImage.SelectedID = this.ModeImage.defaultValue
		this.LevelColor.SelectedColor.CopyFrom(this.LevelColor.defaultColor)
		this.ChargeColor.SelectedColor.CopyFrom(this.ChargeColor.defaultColor)
	}
}
