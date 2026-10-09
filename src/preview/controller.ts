import { previewCanvas } from "../../render"
import { ETeamState } from "../enum"
import { ItemGUI } from "../gui/items"
import { ModifierGUI } from "../gui/modifiers"
import { SpellGUI } from "../gui/spells"
import { ItemDisplay } from "../gui/types"
import { CooldownIcons } from "../menu/icons"
import { MenuManager } from "../menu/index"
import { PreviewDrag } from "./drag"
import { PreviewGroup } from "./group"
import { PreviewGuides } from "./guides"
import { BarArt, BarReachOf, PreviewHealthBar } from "./healthbar"
import {
	BarAbilities,
	DefaultHero,
	Dressed,
	HeroIcon,
	HeroRoster,
	PreviewHero
} from "./heroes"
import { EPreviewUnit, PreviewBarOf, PreviewModel, PreviewWearables } from "./models"
import { PreviewSamples, SampleModifier } from "./samples"
import { PreviewSilence } from "./silence"

const heroHint =
	"The hero the card is dressed for: his body, the items he is given and the abilities the" +
	" sample strip is drawn from"
const wearHint =
	"Stand the hero in the items the game gives him. Turned off, he stands in the body" +
	" underneath them, which is what the game draws before a hero is dressed"
/** The body alone, for a card showing a hero undressed; handed out rather than minted a frame. */
const bare: readonly string[] = []

/** The bear's face, a sprite of the minimap's sheet, which is where the game takes it from. */
const BEAR_ICON: BarArt = {
	path: "materials/vgui/hud/minimap_hero_sheet.vtex_c",
	region: { x: 384, y: 320, width: 32, height: 32 }
}
/** The room kept between the bar's drawing and the edges of the stage, in design pixels. */
const GUTTER = 2
/** How far the bar stands below the top of the stage at least: the silence is drawn over it. */
const SILENCE_ROOM = 33

/** How long the stage takes to drop a cell and bring it back, in seconds. */
const CYCLE = 4
/** The share of that cycle the cell spends away - long enough to read the strip without it. */
const AWAY = 0.28
/** How far the modifiers' cycle is pushed off the items', so the two do not leave together. */
const OFFSET = 0.5

export class PreviewController {
	public readonly Menu: MenuManager
	public readonly Frame: MenuSDK.ScreenRect = { x: 0, y: 0, w: 0, h: 0 }
	public readonly Drag: PreviewDrag
	public readonly Guides = new PreviewGuides()
	public readonly HealthBar = new PreviewHealthBar()
	public readonly Silence = new PreviewSilence()
	public readonly ShowSilence: Menu.Toggle
	public readonly Hero: Menu.Dropdown
	public readonly ShowWearables: Menu.Toggle
	public readonly Node: Menu.Node
	public readonly Unit: Menu.Dropdown
	public readonly Team: Menu.Dropdown
	public readonly Groups: readonly PreviewGroup[]
	public readonly Bar = new Rectangle()
	public Anchor: Nullable<HTMLElement>
	public AnchorArea: Nullable<HTMLElement>
	public AnchorHovered = false
	public readonly AnchorRef = (element: HTMLElement | null | undefined): void => {
		this.Anchor = element ?? undefined
		this.HealthBar.Ref(element)
		if (this.Anchor === undefined) {
			this.Drag.Cancel()
		}
	}
	public readonly AnchorAreaRef = (element: HTMLElement | null | undefined): void => {
		this.AnchorArea = element ?? undefined
		if (this.AnchorArea === undefined) {
			this.AnchorHovered = false
			this.Drag.Cancel()
		}
	}
	private readonly samples = new PreviewSamples()
	/** The point the game draws the unit's bar from, on the stage. */
	private readonly anchor = new Vector2()
	/** The face of the hero the card is dressed for, beside his bar and his courier's. */
	private heroIcon: BarArt = { path: HeroIcon(DefaultHero.name) }
	private readonly cursor = new Vector2()
	private readonly stage = new Vector2()
	private readonly spells: SpellGUI
	private readonly items: ItemGUI
	private readonly modifiers: ModifierGUI
	private readonly visibleItems: ItemDisplay[] = []
	private readonly visibleModifiers: SampleModifier[] = []
	private scale = 1
	/** The hero the card is dressed for: its body, its default items and its abilities. */
	private hero: PreviewHero = DefaultHero
	/** Every hero the picker offers, in the order its options are in. */
	private readonly roster: readonly PreviewHero[]

	constructor(menu: MenuManager) {
		this.Menu = menu
		this.Node = menu.General.AddSettings("Preview", Menu.Icons.IconEye)
		this.Node.SortNodes = false
		this.Unit = this.Node.AddDropdown("Preview unit", [
			"Heroes",
			"Bear",
			"npc_dota_courier",
			"npc_dota_roshan",
			"Familiars",
			"Pandas",
			"Creeps"
		])
		this.Unit.IconPath = CooldownIcons.Heroes
		// the roster is read here rather than when the row is opened: the list has to hold every
		// hero for the one that was picked last time to still be there to pick. It is the hero
		// FILES, though - what a hero wears is the econ file, and that is read only for the hero
		// who ends up on the stage
		const roster = HeroRoster()
		this.roster = roster.length > 0 ? roster : [DefaultHero]
		this.Hero = this.Node.AddDropdown(
			"Preview hero",
			this.roster.map(hero => hero.label),
			Math.max(
				0,
				this.roster.findIndex(hero => hero.name === DefaultHero.name)
			),
			heroHint
		)
		this.Hero.SetOptionIcons(this.roster.map(hero => HeroIcon(hero.name)))
		// the row carries no icon of its own: the option it is set to carries the hero's face, and
		// the same picture twice on one row reads as a mistake. Nor is it dressed here - that is
		// done below, where the drag the change cancels already exists
		this.Hero.executeOnAdd = false
		this.Hero.OnValue(picked => {
			this.Dress(this.roster[picked.SelectedID] ?? DefaultHero)
			this.Drag.Cancel()
			MenuSDK.RefreshPanels()
		})
		this.ShowWearables = this.Node.AddToggle("Show wearables", true, wearHint)
		this.Team = this.Node.AddDropdown(
			"Preview team",
			["Enemies", "Allies", "Your hero"],
			ETeamState.Enemy
		)
		this.Team.IconPath = Menu.Icons.ListFilter
		this.ShowSilence = this.Node.AddToggle("Show silence", true)
		this.Dress(this.roster[this.Hero.SelectedID] ?? DefaultHero)
		const spell = menu.SpellMenu
		const item = menu.ItemMenu
		const modifier = menu.ModifierMenu
		this.Groups = [
			new PreviewGroup(
				"Spells",
				CooldownIcons.Spells,
				spell,
				[
					spell.Hero,
					spell.SpiritBear,
					spell.Courier,
					spell.Roshan,
					spell.Familiar,
					spell.Pandas,
					spell.Creep
				],
				() => this.Unit.SelectedID
			),
			new PreviewGroup(
				"Items",
				CooldownIcons.Items,
				item,
				[item.Hero, item.SpiritBear, item.Courier, item.Roshan],
				() => this.Unit.SelectedID
			),
			new PreviewGroup(
				"Modifiers",
				CooldownIcons.Modifiers,
				modifier,
				[
					modifier.Hero,
					modifier.SpiritBear,
					modifier.Courier,
					modifier.Roshan,
					modifier.Familiar,
					modifier.Pandas
				],
				() => this.Unit.SelectedID
			)
		]
		this.Drag = new PreviewDrag(
			this.Frame,
			() => this.Groups,
			() => [...this.HealthBar.Anchors, ...this.Silence.Anchors]
		)
		const [spellGroup, itemGroup, modifierGroup] = this.Groups
		this.spells = new SpellGUI(
			spellGroup.Canvas,
			spellGroup.Canvas,
			() => this.cursor,
			true
		)
		this.items = new ItemGUI(
			itemGroup.Canvas,
			itemGroup.Canvas,
			() => this.cursor,
			true
		)
		this.modifiers = new ModifierGUI(
			modifierGroup.Canvas,
			modifierGroup.Canvas,
			() => this.cursor,
			true,
			previewCanvas,
			() => this.stage.SetVector(this.Frame.x, this.Frame.y)
		)
		this.Unit.OnValue(() => {
			const hero = this.Unit.SelectedID === EPreviewUnit.Hero
			this.Hero.IsVisible = hero
			this.ShowWearables.IsVisible = hero
			this.Drag.Cancel()
			MenuSDK.RefreshPanels()
		})
		this.Team.OnValue(() => {
			this.Drag.Cancel()
			MenuSDK.RefreshPanels()
		})
	}

	public IsShown(): boolean {
		let page = MenuSDK.ActiveContentNode()
		while (page !== undefined) {
			if (page === this.Menu.Node.entry) {
				return true
			}
			page = page.parent
		}
		return false
	}

	/**
	 * The unit standing on the stage this frame. The host asks every frame and reloads only when
	 * the answer changes, so the picker moving the model costs nothing while it stands still.
	 */
	public Model(): Nullable<string> {
		return PreviewModel(this.Unit.SelectedID, this.Team.SelectedID, this.hero)
	}

	/**
	 * What that unit wears over it, which for everything but a hero is nothing.
	 * Nothing, while the wearables are turned off: a hero's items are most of what makes him
	 * look like himself, and without them the stage shows the body the game ships him as.
	 *
	 *
	 * The hero is dressed HERE rather than where he is picked, because this is the first moment
	 * anyone is looking at him: what a hero wears is fifty megabytes of econ file away, and a
	 * menu that read it to open would be paying for a stage nobody has looked at yet.
	 */
	public Wearables(): readonly string[] {
		if (!this.ShowWearables.value) {
			return bare
		}
		if (this.Unit.SelectedID === EPreviewUnit.Hero) {
			this.hero = Dressed(this.hero)
		}
		return PreviewWearables(this.Unit.SelectedID, this.Team.SelectedID, this.hero)
	}

	/**
	 * Shows another hero: its body, the default items that make it look like itself, the portrait
	 * beside the health bar and the abilities the sample strip is drawn from. The card is a
	 * drawing of the settings, and every part of it is of the same hero or none of it is.
	 */
	public Dress(hero: PreviewHero): void {
		this.hero = hero
		this.heroIcon = { path: HeroIcon(hero.name) }
		const bar = BarAbilities(hero)
		this.samples.SetAbilities(bar.length > 0 ? bar : DefaultHero.abilities)
	}

	public Open(node: Menu.Node): void {
		if (MenuSDK.ElementSettingsNode() === node) {
			MenuSDK.CloseElementSettings()
		} else {
			MenuSDK.OpenElementSettings(node, this.Frame)
		}
	}

	public IsEnabled(group: PreviewGroup): boolean {
		if (!group.Menu.State.value || !group.Settings?.State.value) {
			return false
		}
		if (group.Menu !== this.Menu.ModifierMenu) {
			return group.Menu.TeamState.IsSelected(this.Team.SelectedID)
		}
		return this.samples.Modifiers.some(sample => this.modifierEnabled(sample))
	}

	public Toggle(group: PreviewGroup): void {
		const settings = group.Settings
		if (settings === undefined) {
			return
		}
		const enable = !this.IsEnabled(group)
		if (enable) {
			this.Menu.State.value = true
			group.Menu.State.value = true
			settings.State.value = true
		}
		if (group.Menu === this.Menu.ModifierMenu) {
			for (const sample of this.samples.Modifiers) {
				const category = this.Menu.ModifierMenu[sample.Category]
				category.TeamState.Select(this.Team.SelectedID, enable)
				if (enable) {
					category.State.value = true
				}
			}
		} else {
			group.Menu.TeamState.Select(this.Team.SelectedID, enable)
		}
		MenuSDK.RefreshPanels()
	}

	public Tick(visible: boolean, width: number, height: number): void {
		if (!visible) {
			this.Drag.Cancel()
		}
		this.Drag.Tick()
		this.layBar(width, height)
		const [cursorX, cursorY] = MenuSDK.HostCursorPosition()
		this.cursor.x = cursorX - this.Frame.x
		this.cursor.y = cursorY - this.Frame.y
		if (!this.Drag.Active) {
			this.scale = this.Menu.Scale.value
				? Math.clamp(
						this.cursor.Distance(this.Bar.pos1) / GUIInfo.ScaleHeight(150),
						0.5,
						1
					)
				: 1
		}
		const alpha =
			this.Menu.Opacity.value * 2.55 * (this.Menu.OpacityByCursor.value ? -1 : 1)
		this.samples.Tick()
		// the stage takes a cell away and brings it back, so the entrance the animation row is
		// about is there to watch: the last item, and half a cycle later the last modifier
		this.visibleItems.length = 0
		const items = this.samples.Items
		const shownItems = this.away(0) ? items.length - 1 : items.length
		for (let index = 0; index < shownItems; index++) {
			this.visibleItems.push(items[index])
		}
		const [spell, item, modifier] = this.Groups
		const draw = visible && this.Menu.State.value
		const spellsDrawn = draw && this.IsEnabled(spell)
		spell.Draw(this.spells, this.Bar, this.scale, spellsDrawn, settings =>
			this.spells.DrawAt(
				this.Bar,
				alpha,
				this.Menu.SpellMenu,
				this.samples.Spells,
				settings.Position,
				false,
				false
			)
		)
		const itemsDrawn = draw && this.IsEnabled(item) && this.visibleItems.length > 0
		item.Draw(
			this.items,
			this.Bar,
			this.scale,
			draw && this.IsEnabled(item),
			settings =>
				this.items.DrawAt(
					this.Bar,
					alpha,
					this.Menu.ItemMenu,
					this.visibleItems,
					settings.Position.AddScalarX(
						this.spells.ColumnShift(
							this.Menu.SpellMenu,
							this.Menu.ItemMenu,
							spellsDrawn
						)
					),
					false,
					false
				)
		)
		this.visibleModifiers.length = 0
		for (const sample of this.samples.Modifiers) {
			if (this.modifierEnabled(sample)) {
				this.visibleModifiers.push(sample)
			}
		}
		if (this.visibleModifiers.length > 1 && this.away(OFFSET)) {
			this.visibleModifiers.pop()
		}
		modifier.Draw(
			this.modifiers,
			this.Bar,
			this.scale,
			draw && this.IsEnabled(modifier),
			settings =>
				this.modifiers.DrawAt(
					this.Bar,
					alpha,
					this.Menu.ModifierMenu,
					this.visibleModifiers,
					settings.Position.AddScalarX(
						this.spells.ColumnShift(
							this.Menu.SpellMenu,
							this.Menu.ModifierMenu,
							spellsDrawn
						) +
							this.items.ColumnShift(
								this.Menu.ItemMenu,
								this.Menu.ModifierMenu,
								itemsDrawn
							)
					)
				)
		)
		this.HealthBar.Draw(visible, this.Team.SelectedID)
		this.Silence.Draw(visible && this.ShowSilence.value, this.Bar)
		if (this.AnchorArea !== undefined) {
			const pad = MenuSDK.DpToPx(3)
			const bounds = this.HealthBar.Bounds
			MenuSDK.WriteShown(this.AnchorArea, visible)
			MenuSDK.WritePx(this.AnchorArea, "left", bounds.x - pad)
			MenuSDK.WritePx(this.AnchorArea, "top", bounds.y - pad)
			MenuSDK.WritePx(this.AnchorArea, "width", bounds.w + pad * 2)
			MenuSDK.WritePx(this.AnchorArea, "height", bounds.h + pad * 2)
			MenuSDK.WriteStyle(
				this.AnchorArea,
				"decorator",
				this.AnchorHovered
					? (MenuSDK.SdfShape(
							3,
							"#00000000",
							1,
							MenuSDK.HexOf(MenuSDK.Tokens.Accent)
						).decorator ?? "none")
					: "none"
			)
		}
		this.Guides.Draw(visible ? this.Drag.Guides : [])
	}

	/**
	 * Lays the unit's bar out on the stage: the rectangle the SDK hands the script for it, which
	 * the strips are laid out against, and the point the game draws its own bar from. The drawing
	 * stays whole on the stage - centred where it fits, pushed in from an edge where it does not -
	 * and stands low enough to leave the silence room over it.
	 */
	private layBar(width: number, height: number): void {
		const unit = this.Unit.SelectedID
		const spec = PreviewBarOf(unit, this.Team.SelectedID)
		const pixel = GUIInfo.ScaleHeight(1)
		const reach = BarReachOf(spec)
		const left = (GUTTER - reach.left) * pixel
		const right = width - (reach.right + GUTTER) * pixel
		const anchorX =
			left <= right
				? Math.clamp(width / 2, left, right)
				: (width - (reach.left + reach.right) * pixel) / 2
		const top = Math.max(SILENCE_ROOM, GUTTER - reach.top - spec.correctionY) * pixel
		const bottom = height - (reach.bottom + spec.correctionY + GUTTER) * pixel
		this.Bar.pos1.x = Math.round(anchorX - spec.correctionX * pixel)
		this.Bar.pos1.y = Math.round(
			Math.clamp(height * 0.34, top, Math.max(top, bottom))
		)
		this.Bar.pos2.x = this.Bar.x + spec.width * pixel
		this.Bar.pos2.y = this.Bar.y + spec.height * pixel
		this.anchor.x = this.Bar.x + spec.correctionX * pixel
		this.anchor.y = this.Bar.y + spec.correctionY * pixel
		const bear = unit === EPreviewUnit.SpiritBear
		this.HealthBar.Icon = bear ? BEAR_ICON : this.heroIcon
		this.HealthBar.Level = bear ? "4" : "7"
		this.HealthBar.Layout(this.Bar, this.anchor, spec)
	}

	/** Whether the cell a group cycles is away this instant, on the stage's clock at `offset`. */
	private away(offset: number): boolean {
		return (
			this.Menu.Animation.value &&
			MenuSDK.PreviewMotion.value &&
			(MenuSDK.PreviewClock() / CYCLE + offset) % 1 < AWAY
		)
	}

	private modifierEnabled(sample: SampleModifier): boolean {
		const category = this.Menu.ModifierMenu[sample.Category]
		return category.State.value && category.TeamState.IsSelected(this.Team.SelectedID)
	}
}
