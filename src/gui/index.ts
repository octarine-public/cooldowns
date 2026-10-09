import { canvas as timerCanvas, surface } from "../../render"
import { BaseMenu } from "../menu/base"
import { TextStyleMenu } from "../menu/style"
import { UnitBody } from "../models/body"
import { easeOut, ISlotMotion, SlotMotion } from "./motion"
import { DrawStyledText } from "./text"
import {
	ArtWash,
	GuiCanvas,
	ItemDisplay,
	ModifierDisplay,
	SpellDisplay,
	TextSurface
} from "./types"

export type { CellShapeStyle, ItemDisplay, ModifierDisplay, SpellDisplay } from "./types"

const ORIGIN = new Vector2()

/** The accent wash over the face of a cell that has just landed, at its brightest. */
const RING_TINT = 90
/** The accent the ring's rim itself is struck in. */
const RING_EDGE = 235
/** How much of the ring's life it holds full strength for before it starts to go. */
const RING_HOLD = 1.5
/** How dark the plate over a cell on cooldown is, out of 255. */
const SHADE = 100

/** What a ring is struck on: the strip's own surface, or the SDK canvas a round timer stands on. */
type RingCanvas = Pick<MenuSDK.Canvas, "Rect" | "Circle">

export abstract class BaseGUI {
	protected static readonly border = 2
	/**
	 * The rim of a cell whose spell or item cannot be used: on cooldown, disabled, muted. A
	 * softer red than the pure one, which on a rim this thin over a dark map reads as an alarm
	 * rather than a state.
	 */
	protected static readonly cooldownColor = new Color(229, 72, 77)
	protected static readonly buffColor = new Color(82, 224, 82)
	/** The rim of a cell its owner cannot pay for: what the game washes the icon's bevel in then. */
	protected static readonly noManaOutlineColor = new Color(96, 149, 253)
	/**
	 * What the game washes an icon its owner cannot pay for in, #1569be, at the seven tenths its
	 * contrast rule leaves it at on screen: the blacks of the icon stay black there and its
	 * brightest come out at seven tenths of the wash. A cell here is a third the size of the
	 * game's button, and an icon that dark at that size is a blot, so this is only the dark end
	 * of the wash the brightness row runs; the light end is the same blue at the icon's own
	 * brightness, a mid gray coming out as the bevel's blue and a white as a pale one.
	 */
	private static readonly washDeep = new Color(15, 74, 133)
	private static readonly washLightMid = new Color(96, 149, 253)
	private static readonly washLightTop = new Color(200, 222, 255)
	/** The wash at every brightness the row has stood at, minted once each. */
	private static readonly washes = new Map<number, ArtWash>()
	/** Colours read and never written, so a frame does not mint them per cell. */
	protected static readonly transparent = new Color(0, 0, 0, 0)
	protected static readonly black = new Color(0, 0, 0)
	protected static readonly aqua = new Color(0, 255, 255)

	/**
	 * Scratch colours a cell is drawn in: the canvas reads a style's colours as it is called and
	 * keeps none of them, so one of each serves every cell of the strip in turn.
	 */
	protected readonly cellRim = new Color()
	protected readonly white = new Color(255, 255, 255)
	private readonly shade = new Color(0, 0, 0)

	protected readonly position = new Rectangle()
	protected readonly positionEnd = new Rectangle()
	/** The unit's body under each bar, which a strip set below the bar follows; none in the preview. */
	private body: Nullable<UnitBody>
	private bodyEnd: Nullable<UnitBody>
	/** How far the cell being drawn is into its entrance, as the fade on everything it draws. */
	protected fade = 1
	/** The wash the strip being drawn colours an icon its owner cannot pay for in. */
	protected wash: Nullable<ArtWash>
	/** The entrances and the reflow of this strip's cells, kept between frames. */
	private readonly motion = new SlotMotion()

	/**
	 * `timers` is the SDK canvas a round icon is drawn on as its circular timer, the way
	 * teleport-esp draws its markers, and `origin` is where this surface's own top left corner
	 * stands on that canvas: nowhere in the game, where both are the screen, and at the stage's
	 * frame in the preview. A surface with no such canvas draws its rings itself. `preview` says
	 * the strip is a preview's: its motion runs on the stage's clock and stands still with it.
	 */
	constructor(
		protected readonly canvas: GuiCanvas = surface,
		protected readonly textSurface: TextSurface = surface,
		private readonly cursor: () => Vector2 = () => InputManager.CursorOnScreen,
		private readonly preview = false,
		protected readonly timers: MenuSDK.Canvas | null = timerCanvas,
		protected readonly origin: () => Vector2 = () => ORIGIN
	) {}

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		size: Vector2,
		_additionalSize: number,
		_scale: number,
		body?: UnitBody,
		bodyEnd?: UnitBody
	): void {
		this.body = body
		this.bodyEnd = bodyEnd
		if (position === undefined) {
			this.position.pos1.Invalidate()
			this.position.pos2.Invalidate()
		} else {
			this.position.pos1.CopyFrom(position)
			this.position.pos2.CopyFrom(position).AddForThis(size)
		}

		if (positionEnd === undefined) {
			this.positionEnd.pos1.Invalidate()
			this.positionEnd.pos2.Invalidate()
		} else {
			this.positionEnd.pos1.CopyFrom(positionEnd)
			this.positionEnd.pos2.CopyFrom(positionEnd).AddForThis(size)
		}
	}

	public abstract Draw(
		alpha: number,
		menu: BaseMenu,
		data: [SpellDisplay, number][] | ModifierDisplay[] | ItemDisplay[],
		additionalPosition: Vector2,
		isDisable?: boolean,
		isUniqueDisabled?: boolean
	): void

	/**
	 * Where a strip set `offset` from the bar stands at its anchor, or where a teleport lands.
	 * `rise` is how far over that offset its top edge stands, from {@link BaseGUI.Rise}.
	 */
	protected Follow(offset: Vector2, rise: number, end = false): Vector2 {
		return (end ? this.bodyEnd : this.body)?.Follow(offset, rise) ?? offset
	}
	/**
	 * How far over its offset a strip's top edge stands, as {@link BaseGUI.GetPosition} lays it
	 * out: a row stands on the bar `border` clear of it, and a column hangs from the bar's top.
	 */
	protected Rise(menu: BaseMenu, height: number, border: number): number {
		return menu.IsVertical ? 0 : height + border * 2
	}

	/**
	 * Whether a bar at `position`, or where a teleport lands it, stands under the shop, the
	 * minimap or the scoreboard - a unit's strips all share its bars, so this is asked once a unit
	 * rather than once a strip.
	 */
	public static Covered(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>
	): boolean {
		return BaseGUI.covers(position) || BaseGUI.covers(positionEnd)
	}
	private static covers(position: Nullable<Vector2>): boolean {
		return (
			position !== undefined &&
			(GUIInfo.ContainsShop(position) ||
				GUIInfo.ContainsMiniMap(position) ||
				GUIInfo.ContainsScoreboard(position))
		)
	}
	/**
	 * Opens the strip's frame on its motion. A strip is drawn in the immediate-mode shape the
	 * motion is read back in: open a frame, seat every cell the layout has, close it, and a cell
	 * that was not seated is gone. The preview's motion runs on the stage's clock and is held
	 * with it: an entrance timed against a clock that does not run would never end.
	 */
	protected BeginMotion(menu: BaseMenu): void {
		const preview = this.preview
		this.motion.Begin(
			MenuSDK.DrawClock(preview),
			menu.Animation.value && (!preview || MenuSDK.PreviewMotion.value)
		)
	}
	/**
	 * The tick a cell's reading of its spell or item is good for: everything a cell shows is
	 * networked or timed off the game clock, and both move only as a server tick is applied,
	 * its number landing before its data. The server's tick rather than the game's, which a
	 * pause holds still while the server goes on sending - a spell learned in a pause shows at
	 * once. The preview's cells run on the stage's clock instead and are read afresh every
	 * frame, which is -1.
	 */
	protected Tick(): number {
		return this.preview ? -1 : GameState.CurrentServerTick
	}
	/** Closes the strip's frame: every cell not seated this time is dropped. */
	protected EndMotion(): void {
		this.motion.End()
	}
	/**
	 * Seats `key` as cell `index` of `count` and answers where it actually stands this frame and
	 * how far into its entrance it is. A horizontal strip is centred on the health bar, so its
	 * lanes are counted from the bar's middle and every cell glides half a lane as one leaves or
	 * arrives; a vertical strip hangs from the bar and counts from there.
	 */
	protected Seat(
		key: object,
		index: number,
		count: number,
		vertical = false
	): ISlotMotion {
		return this.motion.Place(key, vertical ? index : index - count / 2)
	}
	/**
	 * Fades everything the cell is about to draw by how far into its entrance it is, and answers
	 * the fade for the alpha the caller carries by hand. A reading drawn through
	 * {@link BaseGUI.Text} in the style's own colour picks it up on its own.
	 */
	protected Enter(cell: ISlotMotion): number {
		this.fade = cell.appear < 1 ? easeOut(cell.appear) : 1
		return this.fade
	}
	/**
	 * The ring a cell that has just landed wears: an accent wash over its face and a rim struck
	 * on its edge, faded as the moment passes. This is what says a new spell, item or buff rather
	 * than a strip that happens to be one cell wider than it was a second ago.
	 *
	 * Nothing about it moves. A rim thrown a few pixels clear of the cell crawls the pixel grid
	 * one step at a time on its way out, and a step every few frames reads as a stutter, not as
	 * motion. Only its alpha changes, and that is smooth.
	 */
	protected Ring(
		target: RingCanvas,
		position: Vector2,
		size: Vector2,
		width: number,
		radius: number,
		circle: boolean,
		flash: number,
		alpha: number
	): void {
		if (flash <= 0 || alpha <= 0) {
			return
		}
		const accent = MenuSDK.HudColors.accent
		const scale = alpha / 255
		const style: MenuSDK.CanvasShapeStyle = {
			color: accent.Clone().SetA(RING_TINT * flash * flash * scale),
			borderColor: accent
				.Clone()
				.SetA(RING_EDGE * Math.min(flash * RING_HOLD, 1) * scale),
			borderWidth: width,
			radius
		}
		if (circle) {
			target.Circle(position, size, style)
		} else {
			target.Rect(position, size, style)
		}
	}
	/**
	 * The dark plate over the face of a cell whose spell or item is on cooldown, the game's own
	 * overlay without its sweep: a round cell takes a disc, a square one its own corners.
	 */
	protected Shade(
		position: Vector2,
		size: Vector2,
		rounding: number,
		alpha: number
	): void {
		this.canvas.Rect(position, size, {
			color: this.shade.SetA(alpha * (SHADE / 255)),
			radius:
				rounding === 0 ? Math.min(size.x, size.y) / 2 : Math.max(rounding / 2, 0)
		})
	}
	/**
	 * The wash an icon its owner cannot pay for is drawn in, at the brightness the row is set
	 * to: the game's own multiply at nought, graded up to the recolour at a hundred.
	 */
	protected NoManaWash(menu: BaseMenu): ArtWash {
		const value = Math.clamp(Math.round(menu.NoMana.value), 0, 100)
		let wash = BaseGUI.washes.get(value)
		if (wash === undefined) {
			const share = value / 100
			wash = {
				mid: BaseGUI.between(BaseGUI.washDeep, 0.5, BaseGUI.washLightMid, share),
				top: BaseGUI.between(BaseGUI.washDeep, 1, BaseGUI.washLightTop, share)
			}
			BaseGUI.washes.set(value, wash)
		}
		return wash
	}
	/** `from` scaled by `scale`, taken `share` of the way to `to`. */
	private static between(from: Color, scale: number, to: Color, share: number): Color {
		return new Color(
			Math.round(from.r * scale * (1 - share) + to.r * share),
			Math.round(from.g * scale * (1 - share) + to.g * share),
			Math.round(from.b * scale * (1 - share) + to.b * share)
		)
	}
	protected Text(
		style: TextStyleMenu,
		text: string,
		position: Rectangle,
		flags: TextFlags,
		division = 2,
		color = this.faded(style.Color.SelectedColor),
		minTextScale = 70
	) {
		DrawStyledText(
			style,
			text,
			position,
			flags,
			position.Height / Math.max(division, 1.2) + 4,
			color,
			this.textSurface,
			minTextScale
		)
	}
	/**
	 * Where the cell in `lane` starts. A horizontal strip is a row over the health bar centred
	 * on it, so a lane is counted from the bar's middle and is a fraction of one while the strip
	 * is reflowing; a vertical strip is a column hanging from the bar's top at its right end,
	 * and counts down from there.
	 */
	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		lane: number,
		additionalPosition: Vector2,
		vertical = false
	) {
		const start = vertical
			? new Vector2(
					rec.x + rec.Width + border * 2,
					rec.y + lane * (size.y + border)
				)
			: new Vector2(
					rec.x + (rec.Width + border) / 2 + lane * (size.x + border),
					rec.y - size.y - border * 2
				)
		return start.AddForThis(additionalPosition).RoundForThis()
	}
	protected GetRounding(menu: BaseMenu, size: Vector2): number {
		const rnd = (menu.Rounding.value / 10) * Math.min(size.x, size.y)
		return rnd === 1 ? -1 : rnd - 1
	}
	protected GetAlpha(mainAlpha: number, vecPos: Vector2, vecSize: Vector2): number {
		if (mainAlpha > 0) {
			return mainAlpha
		}
		const startDistance = (vecSize.x + vecSize.y) * 4
		const cursor = this.cursor()
		const distance = Math.hypot(
			cursor.x - (vecPos.x + vecSize.x / 2),
			cursor.y - (vecPos.y + vecSize.y / 2)
		)
		return -1 * mainAlpha * Math.min(Math.max(0.5, distance / startDistance), 1)
	}
	protected ImageMask(
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		isSilenced: boolean
	) {
		const base = PathData.ImagePath + "/hud/reborn/"
		const image = isSilenced ? "spells_silenced" : "passives_broken"
		this.canvas.Image(base + `${image}_psd.vtex_c`, vecPos, vecSize, {
			radius: Math.max(rounding / 2, 0),
			circle: rounding === 0
		})
	}
	/** `color` at the fade the cell being drawn is at, so its reading comes in with the plate under it. */
	private faded(color: Color): Color {
		return this.fade < 1 ? color.Clone().SetA(color.a * this.fade) : color
	}
}
