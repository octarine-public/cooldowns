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
		additionalSize: number
	): void {
		super.Update(healthBarPosition, healthBarSize, additionalSize)
		const size = ModifierGUI.minSize + additionalSize
		this.size.CopyFrom(GUIInfo.ScaleVector(size, size))
	}

	public Draw(
		menu: ModifierMenu,
		modifiers: Modifier[],
		additionalPosition: Vector2
	): void {
		const vecSize = this.size,
			recPosition = this.position,
			additionalSize = menu.Size.value,
			modeImage = menu.ModeImage.SelectedID,
			modePos = menu.ModePosition.SelectedID,
			border = GUIInfo.ScaleHeight(BaseGUI.border)

		const isRound = modeImage === EModeImage.Round,
			vertical = modePos === EPositionType.Vertical

		for (let index = modifiers.length - 1; index > -1; index--) {
			const modifier = modifiers[index],
				ability = modifier.Ability
			if (ability === undefined) {
				continue
			}
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				index,
				additionalPosition,
				vertical
			)

			// hide item if contains dota hud
			if (GUIInfo.Contains(vecPos)) {
				continue
			}

			const duration = modifier.Duration,
				charge = modifier.StackCount,
				cooldown = modifier.RemainingTime,
				ratio = Math.max(100 * (cooldown / duration), 0)

			const position = new Rectangle(vecPos, vecPos.Add(vecSize)),
				outlinedColor = modifier.IsEnemy() ? Color.Red : Color.Green

			// draw image item
			RendererSDK.Image(ability.TexturePath, vecPos, isRound ? 0 : -1, vecSize)

			// draw outline
			this.outline(ratio, border, position, modeImage, outlinedColor)

			if (charge !== 0) {
				const charges = charge.toString()
				this.Text(charges, position, TextFlags.Right | TextFlags.Bottom)
			}

			if (cooldown <= 0) {
				continue
			}

			const minOffset = 3
			const noCharge = charge === 0
			// if no charge draw cooldown by center
			const flags = noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)
			const canOffset = !noCharge && additionalSize >= minOffset
			const textPosition = canOffset ? position.Clone() : position
			if (canOffset) {
				textPosition.Add(GUIInfo.ScaleVector(minOffset, minOffset))
			}
			this.Text(cdText, textPosition, flags, 2.66)
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
			pos1.AddScalarY(index * (size.y + border))
		} else {
			pos1.AddScalarX(index * (size.x + border * 2))
		}
		return pos1.AddForThis(additional).RoundForThis()
	}

	private outline(
		ratio: number,
		border: number,
		position: Rectangle,
		modeImage: EModeImage,
		outlinedColor: Color
	) {
		const outlineBorder = Math.round(border),
			isCircle = modeImage === EModeImage.Round

		if (isCircle) {
			RendererSDK.Arc(
				-90,
				100,
				position.pos1,
				position.Size,
				false,
				outlineBorder,
				Color.Black,
				0,
				undefined,
				false,
				true
			)
			RendererSDK.Arc(
				-90,
				ratio,
				position.pos1,
				position.Size,
				false,
				outlineBorder,
				outlinedColor,
				0,
				undefined,
				false,
				true
			)
			return
		}
		// inner
		RendererSDK.Radial(
			-90,
			100,
			position.pos1,
			position.Size,
			Color.Black,
			undefined,
			undefined,
			Color.Black,
			false,
			outlineBorder,
			true
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
}
