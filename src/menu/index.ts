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
	public readonly Team: Menu.Dropdown
	public readonly Local: Menu.Toggle

	public readonly ItemMenu: ItemMenu
	public readonly SpellMenu: SpellMenu
	public readonly ModifierMenu: ModifierMenu

	private readonly reset: Menu.Button

	private readonly visual = Menu.AddEntry("Visual")
	private readonly baseNode: Menu.Node
	private readonly teamArray = ["Allies and enemy", "Only enemy"]

	constructor(private readonly sleeper: Sleeper) {
		this.baseNode = this.visual.AddNode(
			"Cooldowns",
			ImageData.Paths.Icons.icon_svg_duration,
			"Displays cooldowns for spells and items",
			0
		)
		this.baseNode.SortNodes = false

		this.State = this.baseNode.AddToggle("State", true)
		this.Local = this.baseNode.AddToggle("Your hero", false)
		this.Team = this.baseNode.AddDropdown("Team", this.teamArray, ETeamState.Enemy)

		this.ItemMenu = new ItemMenu(this.baseNode)
		this.SpellMenu = new SpellMenu(this.baseNode)
		this.ModifierMenu = new ModifierMenu(this.baseNode)

		this.reset = this.baseNode.AddButton("Reset", "Reset settings to default values")
		this.reset.OnValue(() => this.ResetSettings())

		this.Team.OnValue(call => {
			this.Local.IsHidden = call.SelectedID !== 0
			this.baseNode.Update()
		})
	}

	public MenuChnaged(callback: () => void) {
		this.Team.OnValue(() => callback())
		this.Local.OnValue(() => callback())
		this.reset.OnValue(() => callback())

		this.ItemMenu.MenuChanged(callback)
		this.SpellMenu.MenuChanged(callback)
		this.ModifierMenu.MenuChanged(callback)
	}

	public ResetSettings() {
		if (this.sleeper.Sleeping("ResetSettings")) {
			return
		}
		this.ItemMenu.ResetSettings()
		this.SpellMenu.ResetSettings()
		this.ModifierMenu.ResetSettings()
		this.State.value = this.State.defaultValue
		this.Local.value = this.Local.defaultValue
		this.Team.SelectedID = this.Team.defaultValue
		NotificationsSDK.Push(new ResetSettingsUpdated())
		this.sleeper.Sleep(2 * 1000, "ResetSettings")
	}

	public GameChanged() {
		this.sleeper.FullReset()
	}
}
