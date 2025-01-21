import {
	Color,
	GUIInfo,
	Modifier,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { EModeImage, EPositionType } from "../enum"
import { ModifierMenu } from "../menu/modifiers"
import { BaseGUI } from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 18
	private readonly size = new Vector2()

	public Update(
		healthBarPosition: Vector2,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	): void {
		super.Update(healthBarPosition, healthBarSize, additionalSize, scale)
		const size = ModifierGUI.minSize + additionalSize
		this.size.CopyFrom(GUIInfo.ScaleVector(size * scale, size * scale))
	}

	public Draw(
		mainAlpha: number,
		menu: ModifierMenu,
		modifiers: Modifier[],
		additionalPosition: Vector2
	): void {
		// hide item if contains dota hud
		if (this.Contains()) {
			return
		}

		const vecSize = this.size,
			recPosition = this.position,
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
				vertical
			)

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize)

			const charge = modifier.StackCount >> 0,
				cooldown = modifier.RemainingTime,
				duration = modifier.Duration,
				noTimer = duration === -1 || cooldown === 0

			let ratio = Math.max((cooldown / duration) * 100, 0)
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
					? Color.Green
					: Color.Red
			).SetA(alpha)

			this.InnerFillImage(modifier.Name, modeImage, position, alpha)
			this.outline(alpha, ratio, border, position, modeImage, outlinedColor)

			// draw image item
			RendererSDK.Image(
				modifier.GetTexturePath(),
				vecPos,
				modeImage === EModeImage.Round ? 0 : -1,
				vecSize,
				Color.White.SetA(alpha)
			)

			if (charge !== 0) {
				this.Text(
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
			// if no charge draw cooldown by center
			const flags = noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)
			const canOffset = !noCharge && additionalSize >= minOffset
			const textPosition = canOffset
				? position.Clone().Add(GUIInfo.ScaleVector(minOffset, minOffset))
				: position

			this.Text(cdText, textPosition, flags, 2.75)
		}
	}

	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		index: number,
		additional: Vector2,
		vertical = false
	) {
		const pos1 = new Vector2(rec.x, rec.y)
		if (vertical) {
			pos1.AddScalarY(index * (size.y + border * 2)) // border 2 * 2
		} else {
			pos1.AddScalarX(index * (size.x + border * 2)) // border 2 * 2
		}
		return pos1.AddForThis(additional).RoundForThis()
	}

	private outline(
		alpha: number,
		ratio: number,
		border: number,
		position_: Rectangle,
		modeImage: EModeImage,
		outlinedColor: Color
	) {
		const position = position_.Clone()
		const outlineBorder = border + 1

		if (modeImage === EModeImage.Round) {
			RendererSDK.OutlinedCircle(
				position.pos1,
				position.Size,
				Color.Black.SetA(alpha),
				outlineBorder * 2
			)
			RendererSDK.Arc(
				-90,
				ratio,
				position.pos1,
				position.Size,
				false,
				outlineBorder * 2,
				outlinedColor,
				0,
				undefined,
				false,
				false
			)
			return
		}

		RendererSDK.OutlinedRect(
			position.pos1.AddScalar(-1),
			position.Size.AddScalar(outlineBorder - 1),
			outlineBorder,
			Color.Black.SetA(alpha)
		)
		RendererSDK.Radial(
			-90,
			ratio,
			position.pos1,
			position.Size,
			outlinedColor,
			undefined,
			undefined,
			outlinedColor,
			false,
			outlineBorder,
			true
		)
	}

	private InnerFillImage(
		modifierName: string,
		modeImage: EModeImage,
		position: Rectangle,
		alpha: number
	) {
		if (
			!modifierName.startsWith("modifier_rune_") &&
			modifierName !== "modifier_juggernaut_bladeform" &&
			!modifierName.startsWith("modifier_axe_one_")
		) {
			return
		}
		if (modeImage !== EModeImage.Round) {
			RendererSDK.FilledRect(position.pos1, position.Size, Color.Black.SetA(alpha))
			return
		}
		RendererSDK.FilledCircle(position.pos1, position.Size, Color.Black.SetA(alpha))
	}
}
