import { EMeepoClones } from "../enum"
import { BaseGUI } from "../gui/index"
import { ItemGUI } from "../gui/items"
import { ModifierGUI } from "../gui/modifiers"
import { SpellGUI } from "../gui/spells"
import { MenuManager } from "../menu/index"
import { ItemMenu } from "../menu/items"
import { BaseModifierMenu, ModifierMenu } from "../menu/modifiers"
import { SpellMenu } from "../menu/spells"
import { IsTeamSelected } from "../menu/team"
import { UnitBody } from "./body"

/** The spells each Meepo casts on its own: everything else a clone has is the main Meepo's. */
const meepoOwnSpells = new Set(["meepo_earthbind", "meepo_poof"])

export class UnitData {
	/**
	 * The HUD a bar may stand under, as it stood at the start of the frame: the shop and the
	 * scoreboard open and shut and the window is resized on the client, with no tick to say so -
	 * and a paused replay sends no ticks at all. Counted up whenever any of it changes, so a bar's
	 * cover and size are taken again then rather than every frame.
	 */
	private static hud = 0
	private static shopOpen = false
	private static scoreboardOpen = false
	private static readonly window = new Vector2()

	public Priority: number = Infinity
	private items: Item[] = []
	private spells: [Ability, number][] = []
	/** The spells a compact Meepo clone keeps. */
	private ownSpells: [Ability, number][] = []
	private modifiers: Modifier[] = []

	private readonly itemGUI = new ItemGUI()
	private readonly spellGUI = new SpellGUI()
	private readonly modifierGUI = new ModifierGUI()
	/** The body under each bar the unit has: where it stands, and where a teleport lands it. */
	private readonly body = new UnitBody()
	private readonly bodyEnd = new UnitBody()

	/**
	 * What the unit's strips read off it, taken once a server tick: all of it is networked, but
	 * for the bar's size, which is laid out for the window and is taken again with the HUD.
	 */
	private readTick = -1
	private readHud = -1
	private teleported = false
	private shown = false
	private silenced = false
	private passiveDisabled = false
	private muted = false
	private tethered = false
	private barOffset = 0
	private visualShield = false
	private readonly barSize = new Vector2()
	private readonly barCorrection = new Vector2()
	/** Where the bars stood the last time their cover was asked, and the answer, kept for the tick and the HUD. */
	private coverTick = -1
	private coverHud = -1
	private covered = false
	private readonly coverStart = new Vector2().Invalidate()
	private readonly coverEnd = new Vector2().Invalidate()
	private readonly feet = new Vector3()
	private readonly bar = new Vector2()
	private readonly barEnd = new Vector2()

	constructor(public readonly Owner: Unit) {}

	public get IsTeleported() {
		return this.Owner.TPStartPosition.IsValid && this.Owner.TPEndPosition.IsValid
	}
	protected Positions(teleported: boolean): [Nullable<Vector2>, Nullable<Vector2>] {
		const owner = this.Owner,
			start = teleported ? owner.TPStartPosition : owner.Position,
			end = teleported ? owner.TPEndPosition : undefined
		return [
			this.HealthBarPosition(start, this.body, this.bar),
			end?.IsValid
				? this.HealthBarPosition(end, this.bodyEnd, this.barEnd)
				: undefined
		]
	}
	/**
	 * Reads the HUD the bars stand under this frame, before any unit is drawn: once for every
	 * unit, rather than once a unit.
	 */
	public static BeginFrame(): void {
		const shop = GUIInfo.OpenShop.IsOpen,
			scoreboard = GUIInfo.Scoreboard.IsOpen,
			window = RendererSDK.WindowSize
		if (
			shop === UnitData.shopOpen &&
			scoreboard === UnitData.scoreboardOpen &&
			window.x === UnitData.window.x &&
			window.y === UnitData.window.y
		) {
			return
		}
		UnitData.shopOpen = shop
		UnitData.scoreboardOpen = scoreboard
		UnitData.window.CopyFrom(window)
		UnitData.hud++
	}
	/**
	 * Reads what the strips take off the unit, once a server tick: its number is set before its
	 * data is applied, and it runs on through a pause, which holds the game's tick still.
	 */
	private readOwner(): void {
		const tick = GameState.CurrentServerTick,
			hud = UnitData.hud
		if (this.readTick === tick && this.readHud === hud) {
			return
		}
		this.readTick = tick
		this.readHud = hud
		const owner = this.Owner
		this.teleported = this.IsTeleported
		this.shown =
			(this.teleported || owner.IsFogVisible || owner.IsVisible) &&
			owner.IsAlive &&
			!owner.IsHideWorldHud &&
			!(owner.IsCreep && !owner.IsSpawned)
		if (!this.shown) {
			return
		}
		this.silenced = owner.IsSilenced
		this.passiveDisabled = owner.IsPassiveDisabled
		this.muted = owner.IsMuted
		this.tethered = owner.IsTethered
		this.barOffset = owner.HealthBarOffset
		this.visualShield = owner.HasVisualShield
		this.barSize.CopyFrom(owner.HealthBarSize)
		this.barCorrection.CopyFrom(owner.HealthBarPositionCorrection)
	}
	/**
	 * Whether the bars stand under the HUD, asked again only once they move, the HUD changes or a
	 * server tick lands - the last for what the HUD lays out without a flag to watch, such as the
	 * shop's own panels.
	 */
	private isCovered(start: Nullable<Vector2>, end: Nullable<Vector2>): boolean {
		const tick = GameState.CurrentServerTick,
			hud = UnitData.hud
		if (
			this.coverTick === tick &&
			this.coverHud === hud &&
			UnitData.same(this.coverStart, start) &&
			UnitData.same(this.coverEnd, end)
		) {
			return this.covered
		}
		this.coverTick = tick
		this.coverHud = hud
		UnitData.keep(this.coverStart, start)
		UnitData.keep(this.coverEnd, end)
		this.covered = BaseGUI.Covered(start, end)
		return this.covered
	}
	private static same(held: Vector2, position: Nullable<Vector2>): boolean {
		return position === undefined
			? !held.IsValid
			: held.x === position.x && held.y === position.y
	}
	private static keep(held: Vector2, position: Nullable<Vector2>): void {
		if (position === undefined) {
			held.Invalidate()
		} else {
			held.CopyFrom(position)
		}
	}
	public Draw(menu: MenuManager) {
		const itemMenu = menu.ItemMenu,
			spellMenu = menu.SpellMenu,
			modifierMenu = menu.ModifierMenu

		const itemState = itemMenu.State.value,
			spellState = spellMenu.State.value,
			modifierState = modifierMenu.State.value

		if (!itemState && !spellState && !modifierState) {
			return
		}
		const clone = this.cloneMode(menu)
		if (clone === EMeepoClones.Hidden) {
			return
		}
		const compact = clone === EMeepoClones.Compact,
			spells = compact ? this.ownSpells : this.spells
		const spellsDrawn = spellState && spells.length > 0
		const itemsDrawn = itemState && !compact && this.items.length > 0
		const modifiersDrawn = modifierState && this.modifiers.length > 0
		if (!spellsDrawn && !itemsDrawn && !modifiersDrawn) {
			return
		}
		this.readOwner()
		if (!this.shown) {
			return
		}
		const [position, positionEnd] = this.Positions(this.teleported)
		const distanceScale = this.getDistanceScale(position, positionEnd)

		const scale = menu.Scale.value ? distanceScale : 1
		const alpha = menu.Opacity.value * 2.55 * (menu.OpacityByCursor.value ? -1 : 1)

		this.UpdateGUI(scale, position, positionEnd, itemMenu, spellMenu, modifierMenu)
		if (this.isCovered(position, positionEnd)) {
			return
		}

		if (itemsDrawn) {
			this.itemGUI.Draw(
				alpha,
				itemMenu,
				this.items,
				this.GetAdditionalPosition(itemMenu).AddScalarX(
					this.spellGUI.ColumnShift(spellMenu, itemMenu, spellsDrawn)
				),
				this.muted,
				this.tethered
			)
		}

		if (spellsDrawn) {
			this.spellGUI.Draw(
				alpha,
				spellMenu,
				spells,
				this.GetAdditionalPosition(spellMenu),
				this.silenced,
				this.passiveDisabled
			)
		}

		if (modifiersDrawn) {
			this.modifierGUI.Draw(
				alpha,
				modifierMenu,
				this.modifiers,
				this.GetAdditionalPosition(modifierMenu).AddScalarX(
					this.spellGUI.ColumnShift(spellMenu, modifierMenu, spellsDrawn) +
						this.itemGUI.ColumnShift(itemMenu, modifierMenu, itemsDrawn)
				)
			)
		}
	}
	public UnitItemsChanged(newItems: Item[]) {
		this.items = newItems
		this.items.orderBy(x => x.ItemSlot)
	}
	public UnitAbilitiesChanged(newAbils: [Ability, number][]) {
		this.spells = newAbils
		this.spells.orderBy(([, idx]) => idx)
		this.updateOwnSpells()
	}
	public ModifierCreated(modifier: Modifier, menu: ModifierMenu) {
		this.modifiers.push(modifier)
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}
	public ModifierRemoved(modifier: Modifier, menu: ModifierMenu) {
		this.modifiers.remove(modifier)
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}
	public ModifierRestart(newModifiers: Modifier[], menu: ModifierMenu) {
		this.modifiers = newModifiers
		this.modifiers = this.SortModifiers(this.modifiers, menu)
	}
	public HasModifier(modifier: Modifier) {
		return this.modifiers.includes(modifier)
	}
	public EntityDestroyed(entity: Item | Ability) {
		switch (true) {
			case entity instanceof Item:
				this.items.remove(entity)
				this.items.orderBy(x => x.ItemSlot)
				break
			case entity instanceof Ability:
				this.spells.removeCallback(([x]) => x === entity)
				this.spells.orderBy(([, idx]) => idx)
				this.updateOwnSpells()
				break
		}
	}
	public DisposeAll() {
		this.items.clear()
		this.spells.clear()
		this.ownSpells.clear()
		this.modifiers.clear()
	}
	protected GetAdditionalPosition(menu: ItemMenu | SpellMenu | ModifierMenu) {
		const owner = this.Owner
		if (
			owner instanceof npc_dota_visage_familiar &&
			(menu instanceof SpellMenu || menu instanceof ModifierMenu)
		) {
			return menu.Familiar.Position
		}
		if (
			(owner instanceof npc_dota_brewmaster_void ||
				owner instanceof npc_dota_brewmaster_storm ||
				owner instanceof npc_dota_brewmaster_earth) &&
			(menu instanceof SpellMenu || menu instanceof ModifierMenu)
		) {
			return menu.Pandas.Position
		}
		if (owner.IsCreep && menu instanceof SpellMenu) {
			return menu.Creep.Position
		}
		switch (true) {
			case owner.IsHero:
				return menu.Hero.Position
			case owner.IsRoshan:
				return menu.Roshan.Position
			case owner.IsCourier:
				return menu.Courier.Position
			case owner.IsSpiritBear:
				return menu.SpiritBear.Position
			default:
				return new Vector2()
		}
	}
	protected UpdateGUI(
		scale: number,
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		itemMenu: ItemMenu,
		spellMenu: SpellMenu,
		modifierMenu: ModifierMenu
	) {
		const itemState = itemMenu.State.value,
			spellState = spellMenu.State.value,
			modifierState = modifierMenu.State.value,
			healthBarSize = this.barSize

		if (itemState) {
			this.itemGUI.Update(
				position,
				positionEnd,
				healthBarSize,
				itemMenu.Size.value,
				scale,
				this.body,
				this.bodyEnd
			)
		}
		if (spellState) {
			this.spellGUI.Update(
				position,
				positionEnd,
				healthBarSize,
				spellMenu.Size.value,
				scale,
				this.body,
				this.bodyEnd
			)
		}
		if (modifierState) {
			this.modifierGUI.Update(
				position,
				positionEnd,
				healthBarSize,
				modifierMenu.Size.value,
				scale,
				this.body,
				this.bodyEnd
			)
		}
		this.setPriority(position, positionEnd)
	}
	protected CalculateScale(value: number) {
		const startDistance = GUIInfo.ScaleHeight(150)
		return Math.min(Math.max(0.5, value / startDistance), 1)
	}
	protected SortModifiers(modifiers: Modifier[], menu: ModifierMenu) {
		const modifiersMap = new Map<string, Modifier>()
		for (let i = 0, end = modifiers.length; i < end; i++) {
			const modifier = modifiers[i]
			if (modifier === undefined || !modifier.IsValid) {
				continue
			}
			const keyName = this.getKeyName(modifier)
			if (!this.stateModifiers(modifier, menu)) {
				continue
			}
			const modifierInMap = modifiersMap.get(keyName)
			if (
				modifierInMap === undefined ||
				modifierInMap.RemainingTime < modifier.RemainingTime
			) {
				modifiersMap.set(keyName, modifier)
			}
		}
		return [...modifiersMap.values()].orderBy(x => -x.RemainingTime)
	}
	/** Where the bar over `origin` is drawn, into `out`, measuring `body` under it on the way. */
	private HealthBarPosition(
		origin: Vector3,
		body: UnitBody,
		out: Vector2
	): Nullable<Vector2> {
		const height = this.barOffset
		const head = RendererSDK.WorldToScreen(
			this.feet.CopyFrom(origin).AddScalarZ(height)
		)
		if (head === undefined) {
			return undefined
		}
		out.CopyFrom(head)
		if (this.visualShield) {
			out.AddScalarY(5)
		}
		out.SubtractForThis(this.barCorrection)
		body.Measure(out, head, origin, height)
		return out
	}
	/** How this unit is drawn if it is a Meepo clone, or nothing if it is not one. */
	private cloneMode(menu: MenuManager): Nullable<EMeepoClones> {
		const owner = this.Owner
		if (!(owner instanceof npc_dota_hero_meepo) || !owner.IsClone) {
			return undefined
		}
		return menu.MeepoClones.SelectedID as EMeepoClones
	}
	private updateOwnSpells() {
		this.ownSpells = this.spells.filter(([abil]) => meepoOwnSpells.has(abil.Name))
	}
	private getKeyName(modifier: Modifier) {
		if (modifier.Name === "modifier_rubick_spell_steal") {
			return modifier.GetTexturePath()
		}
		return modifier.Name
	}
	private stateModifiers(modifier: Modifier, menu: ModifierMenu) {
		if (modifier.ForceVisible) {
			return true
		}
		if (modifier.IsDisable() || modifier.IsShield() || modifier.IsChannel()) {
			return IsTeamSelected(this.Owner, menu.Important.TeamState)
		}
		if (modifier.IsAura) {
			return this.stateAuras(menu)
		}
		if (modifier.IsBuff()) {
			return this.stateBuffs(menu)
		}
		if (modifier.IsDebuff()) {
			return this.stateDebuffs(menu)
		}
		return false
	}
	private stateAuras(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Auras)
	}
	private stateBuffs(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Buffs)
	}
	private stateDebuffs(menu: ModifierMenu) {
		return !this.isDisabledModifier(menu.Debuffs)
	}
	private isDisabledModifier(menu: BaseModifierMenu) {
		return !menu.State.value || !IsTeamSelected(this.Owner, menu.TeamState)
	}
	private getDistanceScale(start: Nullable<Vector2>, end: Nullable<Vector2>) {
		const position = start ?? end
		return position !== undefined
			? this.CalculateScale(InputManager.CursorOnScreen.Distance(position))
			: 1
	}
	private setPriority(start: Nullable<Vector2>, end: Nullable<Vector2>) {
		let w2s = RendererSDK.WorldToScreen(this.Owner.Position)
		if (w2s === undefined) {
			w2s = start
		}
		if (w2s === undefined) {
			w2s = end
		}
		if (w2s === undefined) {
			this.Priority = Infinity
			return
		}
		this.Priority = w2s.DistanceSqr(InputManager.CursorOnScreen)
	}
}
