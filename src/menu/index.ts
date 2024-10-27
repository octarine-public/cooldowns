import { ImageData, Menu } from "github.com/octarine-public/wrapper/index"

import { ETeamState } from "../enum"
import { ItemMenu } from "./items"
import { ModifierMenu } from "./modifiers"
import { SpellMenu } from "./spells"

export class MenuManager {
	public readonly State: Menu.Toggle
	public readonly Scale: Menu.Toggle
	public readonly OpacityByCursor: Menu.Toggle

	public readonly Team: Menu.Dropdown
	public readonly Local: Menu.Toggle
	public readonly Opacity: Menu.Slider

	public readonly ItemMenu: ItemMenu
	public readonly SpellMenu: SpellMenu
	public readonly ModifierMenu: ModifierMenu

	private readonly baseNode: Menu.Node
	private readonly visual = Menu.AddEntry("Visual")
	private readonly teamArray = ["Allies and enemy", "Only enemy"]

	constructor() {
		this.baseNode = this.visual.AddNode(
			"Cooldowns_v1",
			ImageData.Paths.Icons.icon_svg_time_fast,
			"Displays cooldowns for spells and items"
		)
		this.baseNode.SortNodes = false

		this.State = this.baseNode.AddToggle("State", true)
		this.Scale = this.baseNode.AddToggle(
			"Scale",
			false,
			"Scales abilities, items and modifiers\nnear the mouse"
		)
		this.OpacityByCursor = this.baseNode.AddToggle(
			"Opacity on hover",
			false,
			"Opacity abilities, items and modifiers\nnear the mouse"
		)
		this.Opacity = this.baseNode.AddSlider("Opacity", 100, 40, 100)

		this.Team = this.baseNode.AddDropdown("Team", this.teamArray, ETeamState.Enemy)
		this.Local = this.baseNode.AddToggle("Your hero", false)

		this.SpellMenu = new SpellMenu(this.baseNode)
		this.ItemMenu = new ItemMenu(this.baseNode)
		this.ModifierMenu = new ModifierMenu(this.baseNode)

		this.Team.OnValue(call => {
			this.Local.IsHidden = call.SelectedID !== 0
			this.baseNode.Update()
		})
	}

	public MenuChnaged(callback: () => void) {
		this.Team.OnValue(() => callback())
		this.Local.OnValue(() => callback())

		this.ItemMenu.MenuChanged(callback)
		this.SpellMenu.MenuChanged(callback)
		this.ModifierMenu.MenuChanged(callback)
	}
}
