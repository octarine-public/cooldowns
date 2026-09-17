import { EModeImage, EPositionType } from "../enum"
import { ModifierMenu } from "../menu/modifiers"
import { BaseGUI, ModifierDisplay } from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 18
	/** The rim ring of a round icon: a twelfth of its diameter, and a pixel at least. */
	private static readonly ringFraction = 0.08
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
			modePos = menu.ModePosition.SelectedID,
			border = GUIInfo.ScaleHeight(BaseGUI.border)

		const vertical = modePos === EPositionType.Vertical

		for (let index = modifiers.length - 1; index > -1; index--) {
			const modifier = modifiers[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border + 1,
				index,
				additionalPosition,
				vertical,
				modifiers.length
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

			const outlinedColor =
				isShieldBuff ||
				modifier.IsBuff() ||
				modifier.IsChannel() ||
				(modifier.ForceVisible && !modifier.IsEnemy(modifier.Caster))
					? Color.Green
					: Color.Red

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
			outlinedColor.SetA(alpha)

			this.InnerFillImage(modifier.Name, modeImage, position, alpha)

			this.canvas.Image(modifier.GetTexturePath(), vecPos, vecSize, {
				color: Color.White.SetA(alpha),

				circle: modeImage === EModeImage.Round
			})
			this.outline(alpha, ratio, position, modeImage, outlinedColor)

			if (charge !== 0) {
				this.Text(
					menu.TextStyle,
					charge >= 1000 ? (charge / 1000).toFixed(1) + "k" : charge.toString(),
					position,
					TextFlags.Right | TextFlags.Bottom
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

			this.Text(menu.TextStyle, cdText, textPosition, flags, 2.75)
		}
	}
	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		index: number,
		additional: Vector2,
		vertical = false,
		count = 1
	) {
		const width = vertical ? size.x : count * size.x + (count - 1) * border * 2
		const pos1 = new Vector2(rec.x + (rec.Width - width) / 2, rec.y)
		if (vertical) {
			pos1.AddScalarY(index * (size.y + border * 2))
		} else {
			pos1.AddScalarX(index * (size.x + border * 2))
		}
		return pos1.AddForThis(additional).RoundForThis()
	}
	private outline(
		alpha: number,
		ratio: number,
		position: Rectangle,
		modeImage: EModeImage,
		outlinedColor: Color
	) {
		if (modeImage === EModeImage.Round) {
			this.ring(ratio, position, outlinedColor)
			return
		}

		const outlineBorder = 2
		this.canvas.Rect(position.pos1, position.Size, {
			color: Color.fromUint32(0),
			borderColor: Color.Black.SetA(alpha),
			borderWidth: outlineBorder
		})
		this.canvas.Rect(position.pos1, position.Size, {
			color: Color.fromUint32(0),
			borderColor: outlinedColor,
			borderWidth: outlineBorder,
			start: -90,
			sweep: -ratio * 3.6
		})
	}
	/**
	 * A round modifier as the SDK canvas's circular timer, the marker teleport-esp draws at the
	 * ends of a teleport: the icon cut to a disc, what is left of the modifier as a ring on its
	 * rim in the buff's or debuff's colour, and the seconds left over the middle in the menu's
	 * type. Stacks sit in the bottom right corner beside it. The whole of it fades with the row.
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
		const showTimer = menu.Remaining.value && cooldown > 0
		timers.CircleTimer(at, size, {
			texture: modifier.GetTexturePath(),
			progress: Math.clamp(ratio, 0, 100) / 100,
			color,
			ringWidth: ModifierGUI.ringWidth(size),
			text: showTimer ? cooldown.toFixed(cooldown <= 10 ? 1 : 0) : undefined,
			textScale: ((size / 2.75 + 4) * scale) / size,
			textColor: style.Color.SelectedColor,
			weight: style.FontWeight,
			opacity: Math.clamp(alpha / 255, 0, 1)
		})
		if (charge !== 0) {
			timers.TextIn(
				charge >= 1000 ? (charge / 1000).toFixed(1) + "k" : charge.toString(),
				new Rectangle(at, at.Add(extent)),
				{
					flags: TextFlags.Right | TextFlags.Bottom,
					size: Math.round((size / 2 + 4) * scale),
					color: style.Color.SelectedColor.Clone().SetA(alpha),
					family: style.FontFamily,
					weight: style.FontWeight
				}
			)
		}
	}
	/** The rim ring's width for an icon that size: a twelfth of its diameter, and a pixel at least. */
	private static ringWidth(size: number): number {
		return Math.max(Math.round(size * ModifierGUI.ringFraction), 1)
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
	 * The rim of a round icon in the preview, which has no SDK canvas: what is left of the
	 * modifier, clockwise from twelve o'clock, laid on the icon's own edge and nothing else.
	 */
	private ring(ratio: number, position: Rectangle, outlinedColor: Color) {
		const size = Math.min(position.Width, position.Height)
		const thickness = ModifierGUI.ringWidth(size)
		const radius = (size - thickness) / 2
		if (!(radius > 0)) {
			return
		}
		this.canvas.Arc(
			position.pos1.Add(position.Size.DivideScalar(2)),
			radius,
			thickness,
			-90,
			(Math.clamp(ratio, 0, 100) / 100) * 360,
			outlinedColor
		)
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
