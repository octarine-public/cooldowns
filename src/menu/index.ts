import {
	Menu,
	NotificationsSDK,
	ResetSettingsUpdated,
	Sleeper
} from "github.com/octarine-public/wrapper/index"

import { ItemMenu } from "./items"
import { SpellMenu } from "./spells"

export class MenuManager {
	public readonly State: Menu.Toggle
	public readonly Team: Menu.Dropdown
	public readonly Local: Menu.Toggle

	public readonly ItemMenu: ItemMenu
	public readonly SpellMenu: SpellMenu

	private readonly reset: Menu.Button

	private readonly visual = Menu.AddEntry("Visual")
	private readonly baseNode: Menu.Node
	private readonly sleeper = new Sleeper()
	private readonly teamArray = ["Allies and enemy", "Only enemy"]

	private readonly nodeImage =
		"panorama/images/hud/reborn/icon_attack_speed2_psd.vtex_c"

	constructor() {
		this.baseNode = this.visual.AddNode(
			"Cooldowns",
			this.nodeImage,
			"Displays cooldowns for spells and items",
			0
		)
		this.baseNode.SortNodes = false

		this.State = this.baseNode.AddToggle("State", true)
		this.Local = this.baseNode.AddToggle("Your hero", true)
		this.Team = this.baseNode.AddDropdown("Team", this.teamArray)

		this.ItemMenu = new ItemMenu(this.baseNode)
		this.SpellMenu = new SpellMenu(this.baseNode)

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

		this.ItemMenu.MenuChanged(callback)
		this.SpellMenu.MenuChanged(callback)
	}

	public ResetSettings() {
		if (this.sleeper.Sleeping("ResetSettings")) {
			return
		}
		this.ItemMenu.ResetSettings()
		this.SpellMenu.ResetSettings()
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
