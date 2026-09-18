import { canvas as timerCanvas, surface } from "../../render"
import { BaseMenu } from "../menu/base"
import { TextStyleMenu } from "../menu/style"
import { easeOut, ISlotMotion, SlotMotion } from "./motion"
import { DrawStyledText } from "./text"
import {
	GuiCanvas,
	ItemDisplay,
	ModifierDisplay,
	SpellDisplay,
	TextSurface
} from "./types"

export type { ItemDisplay, ModifierDisplay, SpellDisplay } from "./types"

const ORIGIN = new Vector2()

/** The accent wash over the face of a cell that has just landed, at its brightest. */
const RING_TINT = 90
/** The accent the ring's rim itself is struck in. */
const RING_EDGE = 235
/** How much of the ring's life it holds full strength for before it starts to go. */
const RING_HOLD = 1.5

/** What a ring is struck on: the strip's own surface, or the SDK canvas a round timer stands on. */
type RingCanvas = Pick<MenuSDK.Canvas, "Rect" | "Circle">

export abstract class BaseGUI {
	protected static readonly border = 2
	protected static readonly noManaOutlineColor = new Color(77, 131, 247)

	protected readonly position = new Rectangle()
	protected readonly positionEnd = new Rectangle()
	/** How far the cell being drawn is into its entrance, as the fade on everything it draws. */
	protected fade = 1
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
		_scale: number
	): void {
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

	protected Contains() {
		return (
			GUIInfo.ContainsShop(this.position.pos1) ||
			GUIInfo.ContainsMiniMap(this.position.pos1) ||
			GUIInfo.ContainsScoreboard(this.position.pos1) ||
			GUIInfo.ContainsShop(this.positionEnd.pos1) ||
			GUIInfo.ContainsMiniMap(this.positionEnd.pos1) ||
			GUIInfo.ContainsScoreboard(this.positionEnd.pos1)
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
	 * Where the cell in `lane` starts. A horizontal strip is centred on the health bar, so a lane
	 * is counted from the bar's middle and is a fraction of one while the strip is reflowing; a
	 * vertical strip hangs from its top and counts from there.
	 */
	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		lane: number,
		additionalPosition: Vector2,
		vertical = false
	) {
		const posX = rec.x + (rec.Width + border) / 2
		const posY = rec.y - size.y - border * 2
		const center = new Vector2(posX, posY)
		if (vertical) {
			center.AddScalarY(lane * (size.y + border))
		} else {
			center.AddScalarX(lane * (size.x + border))
		}
		return center.AddForThis(additionalPosition).RoundForThis()
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
