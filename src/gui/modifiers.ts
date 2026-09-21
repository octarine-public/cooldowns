import { EModeImage } from "../enum"
import { ModifierMenu } from "../menu/modifiers"
import { BaseGUI, ModifierDisplay } from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 18
	private static readonly debuffColor = new Color(242, 82, 87)
	/** The band on an icon's edge, ring or frame: a twelfth of its size, and a pixel at least. */
	private static readonly bandFraction = 0.08
	private readonly size = new Vector2()

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	): void {
		super.Update(position, positionEnd, healthBarSize, additionalSize, scale)
		const size = ModifierGUI.minSize + additionalSize
		this.size.CopyFrom(GUIInfo.ScaleVector(size * scale, size * scale))
	}
	public Draw(
		mainAlpha: number,
		menu: ModifierMenu,
		modifiers: ModifierDisplay[],
		additionalPosition: Vector2
	): void {
		if (this.Contains()) {
			return
		}
		this.DrawAt(this.position, mainAlpha, menu, modifiers, additionalPosition)
		this.DrawAt(this.positionEnd, mainAlpha, menu, modifiers, additionalPosition)
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
			additionalSize = menu.Size.value,
			modeImage = menu.ModeImage.SelectedID,
			border = GUIInfo.ScaleHeight(BaseGUI.border)

		const vertical = menu.IsVertical

		for (let index = 0; index < modifiers.length; index++) {
			const modifier = modifiers[index]
			// nothing of this strip moves: a modifier is drawn whole in its own lane the frame it
			// lands and gone the frame it ends, with no entrance, no cascade and no glide
			const lane = vertical ? index : index - modifiers.length / 2
			const vecPos = this.GetPosition(
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

			const position = new Rectangle(vecPos.Clone(), vecPos.Add(vecSize)),
				isShieldBuff = modifier.IsShield() && modifier.IsBuff()

			const outlinedColor = (
				isShieldBuff ||
				modifier.IsBuff() ||
				modifier.IsChannel() ||
				(modifier.ForceVisible && !modifier.IsEnemy(modifier.Caster))
					? BaseGUI.buffColor
					: ModifierGUI.debuffColor
			)
				.Clone()
				.SetA(alpha)

			const timers = this.timers
			if (timers !== null && modeImage === EModeImage.Round) {
				this.circleTimer(
					timers,
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

			this.canvas.Image(modifier.GetTexturePath(), vecPos, vecSize, {
				color: Color.White.SetA(alpha),
				circle: modeImage === EModeImage.Round
			})
			this.outline(ratio, position, modeImage, outlinedColor)

			if (charge !== 0) {
				this.Text(
					menu.TextStyle,
					charge >= 1000 ? (charge / 1000).toFixed(1) + "k" : charge.toString(),
					position,
					TextFlags.Right | TextFlags.Bottom,
					2.75,
					undefined,
					additionalSize === 0 ? 100 : 70
				)
			}

			if (!menu.Remaining.value || cooldown <= 0) {
				continue
			}

			const minOffset = 3
			const noCharge = charge === 0

			const flags = noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)
			const canOffset = !noCharge && additionalSize >= minOffset
			const textPosition = canOffset
				? position.Clone().Add(GUIInfo.ScaleVector(minOffset, minOffset))
				: position

			this.Text(menu.TextStyle, cdText, textPosition, flags)
		}
	}
	/**
	 * A horizontal strip is centred on the health bar with `border` either side of every cell,
	 * so a lane is that pitch from the bar's middle; a vertical one hangs its cells under each
	 * other from the bar, centred on it.
	 */
	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		lane: number,
		additional: Vector2,
		vertical = false
	) {
		const pitch = border * 2
		const pos1 = vertical
			? new Vector2(
					rec.x + (rec.Width - size.x) / 2,
					rec.y + lane * (size.y + pitch)
				)
			: new Vector2(rec.x + rec.Width / 2 + border + lane * (size.x + pitch), rec.y)
		return pos1.AddForThis(additional).RoundForThis()
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
			this.ring(ratio, position, color)
		} else {
			this.frame(ratio, position, color)
		}
	}
	/**
	 * The teleport timer's circular portrait and soft outer shadow, with the modifier's
	 * colour and remaining duration. Readings use the same sizing as item cooldowns and charges.
	 */
	private circleTimer(
		timers: MenuSDK.Canvas,
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
		const style = menu.TextStyle
		const scale = Math.max(style.Size.value, 70) / 100
		// the surface this row is laid out on still frames and drags it
		const extent = position.Size
		this.canvas.Reserve(position.pos1, extent)
		const at = position.pos1.Add(this.origin())
		if (ModifierGUI.isBacked(modifier.Name)) {
			timers.Circle(at, extent, { color: Color.Black.SetA(alpha) })
		}
		const band = ModifierGUI.bandWidth(size)
		timers.CircleTimer(at, size, {
			texture: modifier.GetTexturePath(),
			progress: ratio / 100,
			color: color.Clone().SetA(255),
			ringWidth: band,
			shadow: Math.max(Math.round(size * 0.1), 2),
			innerShadow: false,
			opacity: alpha / 255
		})
		const box = new Rectangle(at, at.Add(extent))
		if (menu.Remaining.value && cooldown > 0) {
			const noCharge = charge === 0
			const textBox =
				!noCharge && menu.Size.value >= 3
					? box.Clone().Add(GUIInfo.ScaleVector(3, 3))
					: box
			timers.TextIn(cooldown.toFixed(cooldown <= 10 ? 1 : 0), textBox, {
				flags: noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top,
				size: Math.round((size / 2 + 4) * scale),
				color: style.Color.SelectedColor.Clone().SetA(alpha),
				family: style.FontFamily,
				weight: style.FontWeight
			})
		}
		if (charge !== 0) {
			const chargeScale =
				Math.max(style.Size.value, menu.Size.value === 0 ? 100 : 70) / 100
			timers.TextIn(
				charge >= 1000 ? (charge / 1000).toFixed(1) + "k" : charge.toString(),
				box,
				{
					flags: TextFlags.Right | TextFlags.Bottom,
					size: Math.round((size / 2.75 + 4) * chargeScale),
					color: style.Color.SelectedColor.Clone().SetA(alpha),
					family: style.FontFamily,
					weight: style.FontWeight
				}
			)
		}
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
	 * The rim of a round icon on a surface with no SDK canvas: the ring the timer draws, laid
	 * on the icon's own edge and nothing else.
	 */
	private ring(ratio: number, position: Rectangle, color: Color) {
		const size = Math.min(position.Width, position.Height),
			band = ModifierGUI.bandWidth(size),
			radius = (size - band) / 2,
			sweep = ModifierGUI.sweep(ratio)
		if (!(radius > 0 && sweep > 0)) {
			return
		}
		this.canvas.Arc(
			position.pos1.Add(position.Size.DivideScalar(2)),
			radius,
			band,
			-90 - sweep,
			sweep,
			color
		)
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
		const runs: [number, number, number, number][] = [
			[first === 0 ? px : mid, y0, x1, y0 + band],
			[x1 - band, first === 1 ? py : y0 + band, x1, y1 - band],
			[x0, y1 - band, first === 2 ? px : x1, y1],
			[x0, y0 + band, x0 + band, first === 3 ? py : y1 - band],
			[first === 4 ? px : x0, y0, mid, y0 + band]
		]
		for (let side = first; side < runs.length; side++) {
			const [left, top, right, bottom] = runs[side]
			if (right > left && bottom > top) {
				this.canvas.Rect(
					new Vector2(left, top),
					new Vector2(right - left, bottom - top),
					{ color }
				)
			}
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
		if (modeImage !== EModeImage.Round) {
			this.canvas.Rect(position.pos1, position.Size, {
				color: Color.Black.SetA(alpha)
			})
			return
		}
		this.canvas.Circle(position.pos1, position.Size, {
			color: Color.Black.SetA(alpha)
		})
	}
}
