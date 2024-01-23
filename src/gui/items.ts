import {
	Color,
	GUIInfo,
	Item,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ItemMenu } from "../menu/items"
import { BaseGUI } from "./index"

export class ItemGUI extends BaseGUI {
	private static readonly minSize = 16
	private static readonly outlineColor = Color.Black

	private readonly size = new Vector2()

	public Update(
		healthBarPosition: Vector2,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	) {
		super.Update(healthBarPosition, healthBarSize, additionalSize, scale)
		const square = ItemGUI.minSize + additionalSize

		this.size.CopyFrom(
			GUIInfo.ScaleVector(square * (88 / 64) * scale, square * scale)
		)
	}

	public Draw(
		mainAlpha: number,
		menu: ItemMenu,
		items: Item[],
		additionalPosition: Vector2,
		isDisable: boolean
	): void {
		const recPosition = this.position,
			additionalSize = menu.Size.value,
			vecSize = new Vector2(
				!!menu.SquareMode.SelectedID ? this.size.y : this.size.x,
				this.size.y
			),
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1)

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

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize)

			const cooldown = item.Cooldown,
				charge = item.CurrentCharges
			const outlineColor = (
				isDisable || item.IsMuted ? Color.Red : ItemGUI.outlineColor.Clone()
			).SetA(alpha)

			const rounding = this.GetRounding(menu, vecSize)

			RendererSDK.RectRounded(
				vecPos,
				vecSize,
				rounding,
				Color.fromUint32(0),
				outlineColor,
				border + +(rounding > 0)
			)

			// draw image item
			RendererSDK.Image(
				item.TexturePath,
				vecPos,
				rounding,
				vecSize,
				Color.White.SetA(alpha)
			)

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
