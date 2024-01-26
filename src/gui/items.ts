import {
	Color,
	GUIInfo,
	Item,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { EModeImage } from "../enum"
import { ItemMenu } from "../menu/items"
import { BaseGUI } from "./index"

export class ItemGUI extends BaseGUI {
	private static readonly minSize = 16
	private static readonly minRoundSize = 18
	private static readonly outlineColor = new Color(35, 38, 40)

	private readonly size = new Vector2()
	private readonly roundSize = new Vector2()

	public Update(
		healthBarPosition: Vector2,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	) {
		super.Update(healthBarPosition, healthBarSize, additionalSize, scale)
		const square = ItemGUI.minSize + additionalSize
		const rounded = ItemGUI.minRoundSize + additionalSize

		this.size.CopyFrom(
			GUIInfo.ScaleVector(square * (88 / 64) * scale, square * scale)
		)
		this.roundSize.CopyFrom(GUIInfo.ScaleVector(rounded * scale, rounded * scale))
	}

	public Draw(
		alpha: number,
		menu: ItemMenu,
		items: Item[],
		additionalPosition: Vector2,
		isDisable: boolean
	): void {
		// hide item if contains dota hud
		if (this.Contains()) {
			return
		}
		const recPosition = this.position,
			additionalSize = menu.Size.value,
			modeImage = menu.ModeImage.SelectedID,
			isRound = modeImage === EModeImage.Round,
			vecSize = isRound ? this.roundSize : this.size,
			border = GUIInfo.ScaleHeight(BaseGUI.border / 2)

		for (let index = items.length - 1; index > -1; index--) {
			const item = items[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				index,
				additionalPosition,
				false, // vertical
				items.length
			)

			const cooldown = item.Cooldown,
				charge = item.CurrentCharges
			const outlineColor = (
				isDisable || item.IsMuted ? Color.Red : ItemGUI.outlineColor
			).SetA(alpha)

			// draw image item
			RendererSDK.Image(
				item.TexturePath,
				vecPos,
				isRound ? 0 : -1,
				vecSize,
				Color.White.SetA(alpha)
			)

			// draw outline
			if (!isRound) {
				RendererSDK.OutlinedRect(
					vecPos,
					vecSize,
					Math.round(border),
					outlineColor
				)
			} else {
				RendererSDK.OutlinedCircle(
					vecPos,
					vecSize,
					outlineColor,
					Math.round(border)
				)
			}

			if (!charge && !cooldown) {
				continue
			}

			const position = new Rectangle(vecPos, vecPos.Add(vecSize))
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
			this.Text(cdText, textPosition, flags)
		}
	}
}
