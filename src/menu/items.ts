import { EMenuType } from "../enum"
import { BaseMenu } from "./base"
import { CooldownIcons } from "./icons"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	HeroSettingsMenu,
	RoshanSettingsMenu
} from "./settings"
import { TextStyleMenu } from "./style"

export class ItemMenu extends BaseMenu {
	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly SquareMode: Menu.Dropdown

	constructor(node: Menu.Node, textStyle: TextStyleMenu, animation: Menu.Toggle) {
		super({
			node,
			textStyle,
			animation,
			nodeName: "Items",
			texture: CooldownIcons.Items
		})
		this.Tree.SortNodes = true
		this.SquareMode = this.Tree.AddDropdown("Shape", ["Rectangle", "Square"])
		this.SquareMode.IconPath = Menu.Icons.GridPick
		this.AddStyle()

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Item)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Item)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Item)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Item)
	}

	public MenuChanged(callback: () => void) {
		this.Size.OnValue(() => callback())
		this.State.OnValue(() => callback())
		this.Rounding.OnValue(() => callback())
		this.TeamState.OnValue(() => callback())
		this.SquareMode.OnValue(() => callback())

		this.SpiritBear.MenuChanged(callback)
		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
	}
}
