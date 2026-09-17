import { EMenuType, EPositionType } from "../enum"
import { BaseMenu } from "./base"
import { CooldownIcons } from "./icons"
import {
	BearSettingsMenu,
	CourierSettingsMenu,
	FamiliarSettingsMenu,
	HeroSettingsMenu,
	PandasSettingsMenu,
	RoshanSettingsMenu
} from "./settings"
import { TextStyleMenu } from "./style"
import { CreateTeamSelect } from "./team"

export class BaseModifierMenu {
	public readonly State: Menu.Toggle
	public readonly TeamState: Menu.MultiSelect
	public readonly DisableByTme: Menu.Slider

	public readonly Tree: Menu.Node

	constructor(
		node: Menu.Node,
		nodeName: string,
		defaultStateTime = 5,
		icon: string,
		tooltip?: string
	) {
		this.Tree = node.AddSettings(nodeName, icon, tooltip)
		this.State = this.Tree.AddToggle("State", true)
		this.Tree.HeaderControl = this.State
		this.TeamState = CreateTeamSelect(this.Tree)
		this.DisableByTme = this.Tree.AddSlider(
			"Disable by time",
			defaultStateTime,
			5,
			120,
			0,
			"Time in minutes"
		)
		this.DisableByTme.IconPath = Menu.Icons.Hourglass
	}

	public MenuChanged(callback: () => void) {
		this.State.OnValue(() => callback())
		this.TeamState.OnValue(() => callback())
		this.DisableByTme.OnValue(() => callback())
	}
}

class AurasSettingsMenu extends BaseModifierMenu {
	public readonly Globally: Menu.Toggle

	constructor(node: Menu.Node) {
		super(node, "Auras", 10, CooldownIcons.Auras)
		this.Globally = this.Tree.AddToggle("Globally")
		this.Globally.IconPath = Menu.Icons.Globe
	}

	public MenuChanged(callback: () => void): void {
		super.MenuChanged(callback)
		this.Globally.OnValue(() => callback())
	}
}
class BuffSettingsMenu extends BaseModifierMenu {
	constructor(node: Menu.Node) {
		super(node, "Buffs", 20, CooldownIcons.Buffs)
	}
}
class DebuffSettingsMenu extends BaseModifierMenu {
	constructor(node: Menu.Node) {
		super(node, "Debuffs", 20, CooldownIcons.Debuffs)
	}
}

class ImportantSettingsMenu extends BaseModifierMenu {
	constructor(node: Menu.Node) {
		super(
			node,
			"Important",
			120,
			CooldownIcons.Important,
			"Important modifiers (stun, silence, shields, etc.)"
		)
		this.DisableByTme.IsHidden = true
		this.DisableByTme.max = 9999
		this.DisableByTme.value = 9999
	}
}

export class ModifierMenu extends BaseMenu {
	public readonly Remaining: Menu.Toggle
	public readonly ModeImage: Menu.Dropdown
	public readonly ModePosition: Menu.Dropdown

	public readonly Hero: HeroSettingsMenu
	public readonly Roshan: RoshanSettingsMenu
	public readonly SpiritBear: BearSettingsMenu
	public readonly Courier: CourierSettingsMenu
	public readonly Familiar: FamiliarSettingsMenu
	public readonly Pandas: PandasSettingsMenu

	public readonly Important: ImportantSettingsMenu
	public readonly Auras: AurasSettingsMenu
	public readonly Buffs: BuffSettingsMenu
	public readonly Debuffs: DebuffSettingsMenu

	private readonly modeImageNames = ["Square", "Circle"]
	private readonly positionNames = ["Vertical", "Horizontal"]

	constructor(node: Menu.Node, textStyle: TextStyleMenu) {
		super({
			node,
			textStyle,
			nodeName: "Modifiers",
			texture: CooldownIcons.Modifiers
		})
		this.Tree.SortNodes = false
		this.Rounding.IsHidden = true
		this.TeamState.IsHidden = true

		this.Remaining = this.Tree.AddToggle(
			"Remaining time",
			false,
			"Show remaining time"
		)
		this.Remaining.IconPath = Menu.Icons.ClockSeconds
		this.ModeImage = this.Tree.AddDropdown("Mode images", this.modeImageNames, 1)
		this.ModeImage.IconPath = Menu.Icons.GridPick
		this.ModePosition = this.Tree.AddDropdown(
			"Position",
			this.positionNames,
			EPositionType.Horizontal
		)
		this.ModePosition.IconPath = Menu.Icons.ArrowUpDown
		this.AddStyle()

		this.Important = new ImportantSettingsMenu(this.Tree)
		this.Auras = new AurasSettingsMenu(this.Tree)
		this.Buffs = new BuffSettingsMenu(this.Tree)
		this.Debuffs = new DebuffSettingsMenu(this.Tree)

		this.Hero = new HeroSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Roshan = new RoshanSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Familiar = new FamiliarSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Courier = new CourierSettingsMenu(this.Tree, EMenuType.Modifier)
		this.SpiritBear = new BearSettingsMenu(this.Tree, EMenuType.Modifier)
		this.Pandas = new PandasSettingsMenu(this.Tree, EMenuType.Modifier)
	}

	public MenuChanged(callback: () => void) {
		this.Size.OnValue(() => callback())
		this.State.OnValue(() => callback())
		this.Rounding.OnValue(() => callback())
		this.ModeImage.OnValue(() => callback())
		this.Remaining.OnValue(() => callback())
		this.ModePosition.OnValue(() => callback())

		this.Auras.MenuChanged(callback)
		this.Buffs.MenuChanged(callback)
		this.Debuffs.MenuChanged(callback)
		this.Important.MenuChanged(callback)

		this.Hero.MenuChanged(callback)
		this.Roshan.MenuChanged(callback)
		this.Courier.MenuChanged(callback)
		this.Pandas.MenuChanged(callback)
		this.Familiar.MenuChanged(callback)
		this.SpiritBear.MenuChanged(callback)
	}
}
