import {
	ImageData,
	Menu,
	NotificationsSDK,
	ResetSettingsUpdated,
	Sleeper
} from "github.com/octarine-public/wrapper/index"

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

	public readonly Reset: Menu.Button
	private readonly baseNode: Menu.Node
	private readonly visual = Menu.AddEntry("Visual")
	private readonly teamArray = ["Allies and enemy", "Only enemy"]

	constructor(private readonly sleeper: Sleeper) {
		this.baseNode = this.visual.AddNode(
			"Cooldowns ",
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
		this.Opacity = this.baseNode.AddSlider("Opacity", 100, 40, 100)
		this.OpacityByCursor = this.baseNode.AddToggle(
			"Opacity on hover",
			false,
			"Opacity abilities, items and modifiers\nnear the mouse"
		)

		this.Team = this.baseNode.AddDropdown("Team", this.teamArray, ETeamState.Enemy)
		this.Local = this.baseNode.AddToggle("Your hero", false)

		this.SpellMenu = new SpellMenu(this.baseNode)
		this.ItemMenu = new ItemMenu(this.baseNode)
		this.ModifierMenu = new ModifierMenu(this.baseNode)

		this.Reset = this.baseNode.AddButton("Reset", "Reset settings to default values")

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
		this.Reset.OnValue(() => this.ResetSettings(callback))
	}

	public ResetSettings(callback: () => void) {
		if (this.sleeper.Sleeping("ResetSettings")) {
			return
		}
		this.ItemMenu.ResetSettings(callback)
		this.SpellMenu.ResetSettings(callback)
		this.ModifierMenu.ResetSettings(callback)
		this.State.value = this.State.defaultValue
		this.Local.value = this.Local.defaultValue
		this.Scale.value = this.Scale.defaultValue
		this.Team.SelectedID = this.Team.defaultValue
		this.Opacity.value = this.Opacity.defaultValue
		this.OpacityByCursor.value = this.OpacityByCursor.defaultValue
		NotificationsSDK.Push(new ResetSettingsUpdated())
		this.sleeper.Sleep(2 * 1000, "ResetSettings")
	}

	public GameChanged() {
		this.sleeper.FullReset()
	}
}
