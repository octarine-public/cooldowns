import { EModeImage } from "../enum"
import { ModifierMenu } from "../menu/modifiers"
import { UnitBody } from "../models/body"
import {
	BaseGUI,
	DrawStyledText,
	ModifierDisplay,
	StripStamp,
	TextSurface,
	TimerSheet
} from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 18
	/**
	 * How tall a reading is against its icon at the text style's full size: what it is on the
	 * smallest icon - half the icon and four pixels for the time left, a 2.75th and four for a
	 * stack count - kept as the icon grows. A few fixed pixels and a fraction of the icon would
	 * thin a reading out against a larger one.
	 */
	private static readonly timeShare =
		(ModifierGUI.minSize / 2 + 4) / ModifierGUI.minSize
	private static readonly countShare =
		(ModifierGUI.minSize / 2.75 + 4) / ModifierGUI.minSize
	private static readonly debuffColor = new Color(242, 82, 87)
	/** The band on an icon's edge, ring or frame: a twelfth of its size, and a pixel at least. */
	private static readonly bandFraction = 0.08
	/**
	 * The readings a countdown shows, minted once each: the tenths of its last ten seconds and the
	 * whole seconds before them, by the tenth or the second they stand for. A countdown reads the
	 * same few strings over and over, from every strip.
	 */
	private static readonly tenths = new Map<number, string>()
	private static readonly seconds = new Map<number, string>()
	/** The stack counts the strips show, minted once each. */
	private static readonly counts = new Map<number, string>()
	private readonly size = new Vector2()
	/**
	 * Scratch the cell being drawn is laid out and painted in: the canvases read a box, a colour
	 * and a style as they are called and keep none of them, so one of each serves every cell of
	 * the strip in turn.
	 */
	private readonly cell = new Vector2()
	private readonly box = new Rectangle()
	private readonly extent = new Vector2()
	private readonly middle = new Vector2()
	private readonly at = new Vector2()
	private readonly timerBox = new Rectangle()
	private readonly offsetBox = new Rectangle()
	private readonly reading = new Color()
	private readonly backing = new Color(0, 0, 0)
	private readonly bandAt = new Vector2()
	private readonly bandSize = new Vector2()
	private readonly artStyle: { color: Color; circle: boolean } = {
		color: this.white,
		circle: false
	}
	private readonly backingStyle: { readonly color: Color } = { color: this.backing }
	private readonly bandStyle: { color: Color } = { color: this.cellRim }

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number,
		body?: UnitBody,
		bodyEnd?: UnitBody
	): void {
		super.Update(
			position,
			positionEnd,
			healthBarSize,
			additionalSize,
			scale,
			body,
			bodyEnd
		)
		const size = (ModifierGUI.minSize + additionalSize) * scale
		this.size.SetVector(GUIInfo.ScaleWidth(size), GUIInfo.ScaleHeight(size))
	}
	/** Lets go of the sheets the strips' round timers were drawn on: the unit is gone. */
	public Dispose(): void {
		this.timers?.Drop?.(this.position)
		this.timers?.Drop?.(this.positionEnd)
	}
	public Draw(
		mainAlpha: number,
		menu: ModifierMenu,
		modifiers: ModifierDisplay[],
		additionalPosition: Vector2
	): void {
		const rise = this.Rise(menu, this.size.y, GUIInfo.ScaleHeight(BaseGUI.border) + 1)
		this.DrawAt(
			this.position,
			mainAlpha,
			menu,
			modifiers,
			this.Follow(additionalPosition, rise)
		)
		this.DrawAt(
			this.positionEnd,
			mainAlpha,
			menu,
			modifiers,
			this.Follow(additionalPosition, rise, true)
		)
	}
	/** The modifier rows every modifier strip reads: the icons' shape and whether the time left is shown. */
	protected PutLook(stamp: StripStamp, menu: ModifierMenu): void {
		stamp.Put(menu.ModeImage.SelectedID)
		stamp.Put(menu.Remaining.value)
	}
	public DrawAt(
		recPosition: Rectangle,
		mainAlpha: number,
		menu: ModifierMenu,
		modifiers: ModifierDisplay[],
		additionalPosition: Vector2
	) {
		if (!recPosition.pos1.IsValid) {
			return
		}
		const vecSize = this.size,
			modeImage = menu.ModeImage.SelectedID,
			border = GUIInfo.ScaleHeight(BaseGUI.border)

		const vertical = menu.IsVertical

		// a round icon is drawn as the SDK's circular timer, on a sheet of the strip's own that is
		// held with the strip's group
		const timers = modeImage === EModeImage.Round ? this.timers : null
		const stamp = this.Restamp(recPosition, mainAlpha, menu, modifiers.length)
		if (stamp !== undefined) {
			stamp.Put(vecSize.x)
			stamp.Put(vecSize.y)
			stamp.Put(border)
			for (let index = 0; index < modifiers.length; index++) {
				stamp.Put(modifiers[index])
			}
			if (
				this.Keep(
					stamp,
					recPosition,
					additionalPosition,
					mainAlpha,
					vecSize,
					timers
				)
			) {
				return
			}
		}
		this.BeginStrip(recPosition, additionalPosition)
		const sheet =
			timers !== null
				? this.OpenSheet(timers, recPosition, additionalPosition)
				: undefined
		for (let index = 0; index < modifiers.length; index++) {
			const modifier = modifiers[index]
			// nothing of this strip moves: a modifier is drawn whole in its own lane the frame it
			// lands and gone the frame it ends, with no entrance, no cascade and no glide
			const lane = vertical ? index : index - modifiers.length / 2
			const vecPos = this.cellAt(
				recPosition,
				vecSize,
				border + 1,
				lane,
				additionalPosition,
				vertical
			)

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize)

			const charge = modifier.StackCount >> 0,
				cooldown = modifier.RemainingTime,
				duration = modifier.Duration,
				noTimer = duration <= 0 || cooldown <= 0

			let ratio = noTimer ? 100 : Math.clamp((cooldown / duration) * 100, 0, 100)
			if ((charge !== 0 && cooldown <= 0) || noTimer) {
				ratio = 100
			}

			const position = this.box,
				isShieldBuff = modifier.IsShield() && modifier.IsBuff()
			position.pos1.CopyFrom(vecPos)
			position.pos2.CopyFrom(vecPos).AddForThis(vecSize)

			const outlinedColor = this.cellRim
				.CopyFrom(
					isShieldBuff ||
						modifier.IsBuff() ||
						modifier.IsChannel() ||
						(modifier.ForceVisible && !modifier.IsEnemy(modifier.Caster))
						? BaseGUI.buffColor
						: ModifierGUI.debuffColor
				)
				.SetA(alpha)

			if (sheet !== undefined) {
				this.circleTimer(
					sheet,
					menu,
					modifier,
					position,
					ratio,
					outlinedColor,
					alpha,
					charge,
					cooldown
				)
				continue
			}

			this.InnerFillImage(modifier.Name, modeImage, position, alpha)

			const art = this.artStyle
			art.color.SetA(alpha)
			art.circle = modeImage === EModeImage.Round
			this.canvas.Image(modifier.GetTexturePath(), vecPos, vecSize, art)
			this.outline(ratio, position, modeImage, outlinedColor)
			this.readings(this.textSurface, menu, position, charge, cooldown)
		}
		this.EndStrip()
	}
	/**
	 * The stack count in the icon's bottom right corner, and the time left over its middle, or in
	 * its top left corner beside a count. Each is the share of the icon it has on the smallest
	 * one, and a count is never set under the style's full size: under it, a count on the
	 * smallest icon no longer reads.
	 */
	private readings(
		target: TextSurface,
		menu: ModifierMenu,
		box: Rectangle,
		charge: number,
		cooldown: number,
		color?: Color
	) {
		const style = menu.TextStyle,
			height = box.Height
		if (charge !== 0) {
			DrawStyledText(
				style,
				ModifierGUI.countText(charge),
				box,
				TextFlags.Right | TextFlags.Bottom,
				height * ModifierGUI.countShare,
				color,
				target,
				100
			)
		}
		if (!menu.Remaining.value || cooldown <= 0) {
			return
		}
		const minOffset = 3,
			noCharge = charge === 0
		let textBox = box
		if (!noCharge && menu.Size.value >= minOffset) {
			const dx = GUIInfo.ScaleWidth(minOffset),
				dy = GUIInfo.ScaleHeight(minOffset)
			textBox = this.offsetBox
			textBox.pos1.CopyFrom(box.pos1).AddScalarX(dx).AddScalarY(dy)
			textBox.pos2.CopyFrom(box.pos2).AddScalarX(dx).AddScalarY(dy)
		}
		DrawStyledText(
			style,
			ModifierGUI.timeText(cooldown),
			textBox,
			noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top,
			height * ModifierGUI.timeShare,
			color,
			target
		)
	}
	/**
	 * A horizontal strip is centred on the health bar with `border` either side of every cell,
	 * so a lane is that pitch from the bar's middle; a vertical one stands beside the bar's right
	 * end, as the spell and item columns do, its cells under each other from the bar's top. A
	 * column is laid from the bar's end rather than its middle so one offset clears every bar:
	 * Roshan's is twice a hero's, and a column pushed clear of a hero's stood on his. The cell is
	 * laid out from the strip's whole-pixel anchor, as every strip's is, into the strip's scratch.
	 */
	private cellAt(
		rec: Rectangle,
		size: Vector2,
		border: number,
		lane: number,
		additional: Vector2,
		vertical: boolean
	): Vector2 {
		const pitch = border * 2
		return this.cell
			.SetVector(
				Math.round(
					vertical
						? rec.Width + pitch
						: rec.Width / 2 + border + lane * (size.x + pitch)
				),
				vertical ? Math.round(lane * (size.y + pitch)) : 0
			)
			.AddScalarX(BaseGUI.Anchor(rec.x, additional.x))
			.AddScalarY(BaseGUI.Anchor(rec.y, additional.y))
	}
	/** The text of a stack count: as it is, or in thousands to a tenth from a thousand on. */
	private static countText(charge: number): string {
		let text = ModifierGUI.counts.get(charge)
		if (text === undefined) {
			text = charge >= 1000 ? (charge / 1000).toFixed(1) + "k" : charge.toString()
			ModifierGUI.counts.set(charge, text)
		}
		return text
	}
	/** The text of the time left: to a tenth over the last ten seconds, in whole seconds before them. */
	private static timeText(cooldown: number): string {
		const fine = cooldown <= 10,
			key = Math.round(fine ? cooldown * 10 : cooldown),
			texts = fine ? ModifierGUI.tenths : ModifierGUI.seconds
		let text = texts.get(key)
		if (text === undefined) {
			text = fine ? (key / 10).toFixed(1) : key.toString()
			texts.set(key, text)
		}
		return text
	}
	/**
	 * What is left of the modifier, on the icon's own edge and over its art: a ring on a round
	 * icon, a frame on a square one, either ending at twelve o'clock with its start coming round
	 * clockwise as the modifier runs out, the way the game's own buff icons drain.
	 */
	private outline(
		ratio: number,
		position: Rectangle,
		modeImage: EModeImage,
		color: Color
	) {
		if (modeImage === EModeImage.Round) {
			ModifierGUI.ring(
				this.canvas,
				this.middle.SetVector(
					position.x + position.Width / 2,
					position.y + position.Height / 2
				),
				Math.min(position.Width, position.Height),
				ratio,
				color
			)
		} else {
			this.frame(ratio, position, color)
		}
	}
	/**
	 * A round portrait with the modifier's colour and remaining duration, the art cut to a disc
	 * and the ring on its rim with nothing round it: a halo blurs an icon this small. Its readings
	 * are a square icon's, laid out the overlay's way on the surface the portrait stands on.
	 */
	private circleTimer(
		sheet: TimerSheet,
		menu: ModifierMenu,
		modifier: ModifierDisplay,
		position: Rectangle,
		ratio: number,
		color: Color,
		alpha: number,
		charge: number,
		cooldown: number
	) {
		const size = Math.min(position.Width, position.Height)
		// the surface this row is laid out on still frames and drags it
		const extent = this.extentOf(position)
		this.canvas.Reserve(position.pos1, extent)
		const at = this.at
				.CopyFrom(position.pos1)
				.AddForThis(this.origin())
				.SubtractForThis(this.anchorPoint),
			timers = sheet.Canvas
		if (ModifierGUI.isBacked(modifier.Name)) {
			this.backing.SetA(alpha)
			timers.Circle(at, extent, this.backingStyle)
		}
		const art = this.artStyle
		art.color.SetA(alpha)
		art.circle = true
		timers.Image(modifier.GetTexturePath(), at, extent, art)
		ModifierGUI.ring(
			timers,
			this.middle.SetVector(at.x + size / 2, at.y + size / 2),
			size,
			ratio,
			color
		)
		const box = this.timerBox
		box.pos1.CopyFrom(at)
		box.pos2.CopyFrom(at).AddForThis(extent)
		this.readings(
			sheet.Text,
			menu,
			box,
			charge,
			cooldown,
			this.reading.CopyFrom(menu.TextStyle.Color.SelectedColor).SetA(alpha)
		)
	}
	/** The size of the box `position`, into the strip's scratch. */
	private extentOf(position: Rectangle): Vector2 {
		return this.extent.CopyFrom(position.pos2).SubtractForThis(position.pos1)
	}
	/** The band's width for an icon that size: a twelfth of it, and a pixel at least. */
	private static bandWidth(size: number): number {
		return Math.max(Math.round(size * ModifierGUI.bandFraction), 1)
	}
	/** How far round the icon the band reaches for what is left of the modifier, in degrees. */
	private static sweep(ratio: number): number {
		return Math.clamp(ratio, 0, 100) * 3.6
	}
	/** Whether the icon's art is cut out and wants a black disc behind it. */
	private static isBacked(modifierName: string): boolean {
		return (
			modifierName.startsWith("modifier_rune_") ||
			modifierName === "modifier_juggernaut_bladeform" ||
			modifierName.startsWith("modifier_axe_one_")
		)
	}
	/**
	 * The rim of a round icon `size` across about `center`, on the SDK timer's canvas or on a
	 * surface with none: a band on the icon's own edge and nothing else, ending at twelve
	 * o'clock with its start coming round clockwise as the modifier runs out.
	 */
	private static ring(
		canvas: Pick<MenuSDK.Canvas, "Arc">,
		center: Vector2,
		size: number,
		ratio: number,
		color: Color
	) {
		const band = ModifierGUI.bandWidth(size),
			radius = (size - band) / 2,
			sweep = ModifierGUI.sweep(ratio)
		if (!(radius > 0 && sweep > 0)) {
			return
		}
		canvas.Arc(center, radius, band, -90 - sweep, sweep, color)
	}
	/**
	 * The frame of a square icon, the ring's counterpart: a band as wide as the ring's on the
	 * icon's own edge, over its art, from where the sweep starts clockwise round to twelve
	 * o'clock. It is laid as plain rectangles, one for each side the sweep reaches, the corners
	 * going with the top and bottom sides so nothing is painted twice - a band fading with the
	 * row would show where it overlapped itself. Where the sweep starts the band is cut square
	 * across its side rather than along the radius, a pixel or two on a band this thin.
	 */
	private frame(ratio: number, position: Rectangle, color: Color) {
		const width = Math.round(position.Width),
			height = Math.round(position.Height),
			band = ModifierGUI.bandWidth(Math.min(width, height)),
			sweep = ModifierGUI.sweep(ratio)
		if (!(sweep > 0) || width <= band * 2 || height <= band * 2) {
			return
		}
		const x0 = position.x,
			y0 = position.y,
			x1 = x0 + width,
			y1 = y0 + height,
			mid = Math.round(x0 + width / 2)
		const angle = ((360 - sweep) * Math.PI) / 180,
			dx = Math.sin(angle),
			dy = -Math.cos(angle),
			reach = Math.min(width / 2 / Math.abs(dx), height / 2 / Math.abs(dy)),
			px = Math.round(x0 + width / 2 + dx * reach),
			py = Math.round(y0 + height / 2 + dy * reach),
			corner = Math.atan2(width, height)
		const first =
			angle < corner
				? 0
				: angle < Math.PI - corner
					? 1
					: angle < Math.PI + corner
						? 2
						: angle < 2 * Math.PI - corner
							? 3
							: 4
		this.bandStyle.color = color
		if (first <= 0) {
			this.side(first === 0 ? px : mid, y0, x1, y0 + band)
		}
		if (first <= 1) {
			this.side(x1 - band, first === 1 ? py : y0 + band, x1, y1 - band)
		}
		if (first <= 2) {
			this.side(x0, y1 - band, first === 2 ? px : x1, y1)
		}
		if (first <= 3) {
			this.side(x0, y0 + band, x0 + band, first === 3 ? py : y1 - band)
		}
		this.side(first === 4 ? px : x0, y0, mid, y0 + band)
	}
	/** One side of the frame, from `left`, `top` to `right`, `bottom`, if the sweep leaves any of it. */
	private side(left: number, top: number, right: number, bottom: number): void {
		if (right > left && bottom > top) {
			this.canvas.Rect(
				this.bandAt.SetVector(left, top),
				this.bandSize.SetVector(right - left, bottom - top),
				this.bandStyle
			)
		}
	}
	private InnerFillImage(
		modifierName: string,
		modeImage: EModeImage,
		position: Rectangle,
		alpha: number
	) {
		if (!ModifierGUI.isBacked(modifierName)) {
			return
		}
		this.backing.SetA(alpha)
		if (modeImage !== EModeImage.Round) {
			this.canvas.Rect(position.pos1, this.extentOf(position), this.backingStyle)
			return
		}
		this.canvas.Circle(position.pos1, this.extentOf(position), this.backingStyle)
	}
}
