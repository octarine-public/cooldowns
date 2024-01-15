import { Color, ImageData, Menu } from "github.com/octarine-public/wrapper/index"

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
	public readonly LevelType: Menu.Dropdown
	public readonly ModeImage: Menu.Dropdown

	public readonly LevelColor: Menu.ColorPicker
	public readonly ChargeColor: Menu.ColorPicker

	public readonly Hero: HeroSettingsMenu
	public readonly Creep: CreepSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu

	constructor(node: Menu.Node) {
		super({
			node,
			defaultSize: 6,
			nodeName: "Spells",
			texture: ImageData.Paths.Icons.icon_svg_hamburger
		})

		this.Tree.SortNodes = false

		this.ModeImage = this.Tree.AddDropdown("Mode images", ["Square", "Circle"])
		this.LevelType = this.Tree.AddDropdown("Level type", ["Square", "Text"])

		this.LevelColor = this.Tree.AddColorPicker("Level color", Color.Green)
		this.ChargeColor = this.Tree.AddColorPicker("Charge color", Color.Green)

		this.Hero = new HeroSettingsMenu(this.Tree)
		this.Creep = new CreepSettingsMenu(this.Tree)
		this.Roshan = new RoshanSettingsMenu(this.Tree)
		this.Courier = new CourierSettingsMenu(this.Tree)
		this.SpiritBear = new BearSettingsMenu(this.Tree)
		this.Familiar = new FamiliarSettingsMenu(this.Tree)
	}

	public IsSpellMenu<T extends BaseMenu>(menu: BaseMenu): menu is T {
		return true
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

	public ResetSettings() {
		super.ResetSettings()
		this.Hero.ResetSettings()
		this.Creep.ResetSettings()
		this.Roshan.ResetSettings()
		this.Courier.ResetSettings()
		this.Familiar.ResetSettings()
		this.SpiritBear.ResetSettings()

		this.Size.value = this.Size.defaultValue
		this.LevelType.SelectedID = this.LevelType.defaultValue
		this.ModeImage.SelectedID = this.ModeImage.defaultValue
		this.LevelColor.SelectedColor.CopyFrom(this.LevelColor.defaultColor)
		this.ChargeColor.SelectedColor.CopyFrom(this.ChargeColor.defaultColor)
	}
}
