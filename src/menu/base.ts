import { EPositionType, ETeamState } from "../enum"
import { TextStyleMenu } from "./style"
import { CreateTeamSelect } from "./team"

interface IBaseBaseMenu {
	node: Menu.Node
	textStyle: TextStyleMenu
	animation: Menu.Toggle
	noMana: Menu.Slider
	nodeName: string
	defaultSize?: number
	defaultState?: boolean
	tooltip?: string
	texture: string
	defaultTeamState?: ETeamState[]
}

export class BaseMenu {
	public readonly Tree: Menu.Node
	public readonly State: Menu.Toggle
	public readonly Size: Menu.Slider
	public readonly Rounding: Menu.Slider
	public readonly TeamState: Menu.MultiSelect
	/** The script's one switch for its motion, on the General tab, read beside the element's own rows. */
	public readonly Animation: Menu.Toggle
	/** How bright an icon its owner cannot pay for is drawn, on the General tab, read the same way. */
	public readonly NoMana: Menu.Slider

	private readonly shared: TextStyleMenu
	private style: Nullable<TextStyleMenu>
	private position: Nullable<Menu.Dropdown>

	constructor(options: IBaseBaseMenu) {
		this.shared = options.textStyle
		this.Animation = options.animation
		this.NoMana = options.noMana
		this.Tree = options.node.AddNode(
			options.nodeName,
			options.texture,
			options.tooltip
		)
		this.Tree.SortNodes = false
		this.State = this.Tree.AddToggle("State", options.defaultState ?? true)
		// a tab keeps its switch as the first row of its own card: the top bar
		// already carries the script's own, and the gate greys the tab when off
		this.Tree.Gate = this.State
		this.TeamState = CreateTeamSelect(
			this.Tree,
			options.defaultTeamState ?? [ETeamState.Enemy]
		)
		this.Size = this.Tree.AddSlider(
			"Additional size",
			options.defaultSize ?? 0,
			0,
			20
		)
		this.Size.IconPath = Menu.Icons.Expand
		this.Rounding = this.Tree.AddSlider("Rounding", 0, 0, 10)
		this.Rounding.IconPath = Menu.Icons.Radius
	}

	public get Style(): TextStyleMenu {
		return this.AddStyle()
	}

	public get TextStyle(): TextStyleMenu {
		return this.Style.Effective
	}

	/** Whether the strip stands as a column beside the health bar rather than a row over it. */
	public get IsVertical(): boolean {
		return this.position?.SelectedID === EPositionType.Vertical
	}

	/**
	 * Declares the element's text settings row. A subclass calls this once it has
	 * added its own rows, so the row lands below them and above the sub-settings.
	 */
	protected AddStyle(): TextStyleMenu {
		return (this.style ??= new TextStyleMenu(this.Tree, this.shared))
	}

	/**
	 * Declares the strip's run: a row over the health bar, or a column beside it. A subclass
	 * calls this where the row belongs among its own.
	 */
	protected AddPosition(): Menu.Dropdown {
		if (this.position === undefined) {
			this.position = this.Tree.AddDropdown(
				"Position",
				["Vertical", "Horizontal"],
				EPositionType.Horizontal
			)
			this.position.IconPath = Menu.Icons.ArrowUpDown
		}
		return this.position
	}
}
