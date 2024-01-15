import {
	Ability,
	Color,
	GUIInfo,
	invoker_exort,
	invoker_quas,
	invoker_wex,
	Item,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ELevelType, EModeImage } from "../enum"
import { ItemMenu } from "../menu/items"
import { SpellMenu } from "../menu/spells"

export class BaseGUI {
	private static readonly border = 2
	private static readonly fontWidth = 400
	private static readonly minItemSize = 16
	private static readonly minSpellSize = 18

	private readonly itemSize = new Vector2()
	private readonly spellSize = new Vector2()
	private readonly position = new Rectangle()

	// update gui full positions and sizes
	public Update(
		healthBarPosition: Vector2,
		healthBarSize: Vector2,
		additionalSizeItem: number,
		additionalSizeSpell: number,
		itemState: boolean,
		spellState: boolean
	) {
		this.position.pos1.CopyFrom(healthBarPosition)
		this.position.pos2.CopyFrom(healthBarPosition.Add(healthBarSize))

		if (spellState) {
			const spellSize = BaseGUI.minSpellSize + additionalSizeSpell
			this.spellSize.CopyFrom(GUIInfo.ScaleVector(spellSize, spellSize))
		}

		if (itemState) {
			const itemSize = BaseGUI.minItemSize + additionalSizeItem
			this.itemSize.CopyFrom(GUIInfo.ScaleVector(itemSize * 1.3, itemSize))
		}
	}

	public DrawSpells(
		menu: SpellMenu,
		isDisable: boolean,
		spells: Ability[],
		additionalPosition: Vector2
	) {
		const isVertical = false,
			vecSize = this.spellSize,
			recPosition = this.position,
			modeImage = menu.ModeImage.SelectedID

		const border = GUIInfo.ScaleHeight(BaseGUI.border)
		for (let index = spells.length - 1; index > -1; index--) {
			const spell = spells[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				isVertical,
				spells.length,
				index,
				additionalPosition
			)

			// hide item if contains dota hud
			if (GUIInfo.Contains(vecPos)) {
				continue
			}

			const cooldown = spell.Cooldown,
				currCharges = spell.CurrentCharges

			// width of outlined
			const width = Math.floor((vecSize.y + border) / 5)
			const position = new Rectangle(vecPos, vecPos.Add(vecSize))

			this.Image(
				spell.TexturePath,
				vecPos,
				vecSize,
				width,
				cooldown,
				modeImage,
				spell.Level === 0 || isDisable,
				spell.IsInAbilityPhase || spell.IsChanneling,
				isDisable
			)

			const levelType = menu.LevelType.SelectedID,
				levelColor = menu.LevelColor.SelectedColor,
				chargeColor = menu.ChargeColor.SelectedColor

			// draw cooldown text
			if (cooldown !== 0) {
				const cdText = cooldown.toFixed(cooldown <= 3 ? 1 : 0)
				this.Text(cdText, position, TextFlags.Center)
			}

			// draw charges
			if (currCharges !== 0) {
				this.textChargeOrLevel(currCharges, true, position, chargeColor)
			}

			// don't draw level if max level or level = 0
			if (spell.MaxLevel <= 1 || spell.Level === 0) {
				continue
			}

			switch (levelType) {
				case ELevelType.Square:
					// draw level by square
					this.SquareLevel(spell, levelColor, vecPos, vecSize)
					break
				default: {
					// draw level by text
					this.textChargeOrLevel(spell.Level, false, position, levelColor)
					break
				}
			}
		}
	}

	public DrawItems(
		_menu: ItemMenu,
		_isDisabled: boolean,
		items: Item[],
		additionalPosition: Vector2
	) {
		const isVertical = false
		const baseSize = this.itemSize
		const recPosition = this.position
		const borderSize = GUIInfo.ScaleHeight(BaseGUI.border / 2)

		for (let index = items.length - 1; index > -1; index--) {
			const item = items[index]
			const vecPosition = this.GetPosition(
				recPosition,
				baseSize,
				borderSize,
				isVertical,
				items.length,
				index,
				additionalPosition
			)
			// hide item if contains dota hud
			if (GUIInfo.Contains(vecPosition)) {
				continue
			}
			this.SquareItems(item, vecPosition, baseSize)
		}
	}

	protected SquareItems(item: Item, calcPosition: Vector2, baseSize: Vector2) {
		const cooldown = item.Cooldown,
			currCharges = item.CurrentCharges

		// draw image item
		RendererSDK.Image(item.TexturePath, calcPosition, -1, baseSize)

		if (!currCharges && !cooldown) {
			return
		}

		const position = new Rectangle(calcPosition, calcPosition.Add(baseSize))

		if (cooldown !== 0) {
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)
			this.Text(cdText, position, TextFlags.Left | TextFlags.Top)
		}

		if (currCharges !== 0) {
			const charges = currCharges.toString()
			this.Text(charges, position, TextFlags.Right | TextFlags.Bottom)
		}
	}

	protected Text(
		text: string,
		position: Rectangle,
		flags: TextFlags,
		division = 2,
		color: Color = Color.White
	) {
		RendererSDK.TextByFlags(text, position, color, division, flags, BaseGUI.fontWidth)
	}

	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		isVertical: boolean,
		abilCount: number,
		index: number,
		additionalPosition: Vector2
	) {
		const center = new Vector2(
			rec.x + (rec.Width + border) / 2,
			rec.y - size.y - border * 2
		)
			.SubtractScalarX(((size.x + border) * (!isVertical ? abilCount : 0)) / 2)
			.AddForThis(additionalPosition)
		return (
			!isVertical
				? center.AddScalarX(index * (size.x + border))
				: center.AddScalarY(index * (size.y + border))
		)
			.DivideScalarX(GUIInfo.GetWidthScale())
			.DivideScalarY(GUIInfo.GetHeightScale())
			.RoundForThis(1)
	}

	protected SquareLevel(
		spell: Ability,
		levelColor: Color,
		vecPos: Vector2,
		vecSize: Vector2
	) {
		const currLvl = spell.Level
		if (spell.MaxLevel === 1 || spell.Level === 0) {
			return
		}

		const position = new Rectangle(vecPos, vecPos.Add(vecSize))

		// if invoker
		if (
			spell instanceof invoker_quas ||
			spell instanceof invoker_wex ||
			spell instanceof invoker_exort
		) {
			this.Text(currLvl.toString(), position, TextFlags.Right | TextFlags.Bottom)
			return
		}

		position.Height /= 4
		position.y += position.Width - position.Height

		// debug
		// RendererSDK.FilledRect(imagePosition.pos1, imagePosition.Size, Color.Red)

		const border = GUIInfo.ScaleHeight(1)
		const boxOffset = position.Height * 0.75

		const size = new Vector2(boxOffset, boxOffset)
		for (let index = 0; index < currLvl; index++) {
			const center = new Vector2(
				position.x + border + Math.floor(position.Width / 2),
				position.y + border
			)
				.SubtractScalarX(((size.x + border) * currLvl) / 2)
				.AddScalarX(index * (size.x + border))
				.FloorForThis()

			RendererSDK.FilledRect(center, size, levelColor)
			RendererSDK.OutlinedRect(center, size, size.y / 2, Color.Black)
		}
	}

	protected Image(
		texture: string,
		vecPos: Vector2,
		vecSize: Vector2,
		width: number,
		cooldown: number,
		modeImage: EModeImage,
		grayScale: boolean,
		isInPhase?: boolean,
		isDisable?: boolean
	) {
		const isCircle = modeImage === EModeImage.Round ? 0 : -1,
			outlinedColor =
				cooldown !== 0 || isDisable
					? Color.Red
					: isInPhase
						? Color.Green
						: Color.Black

		switch (modeImage) {
			case EModeImage.Round:
				RendererSDK.OutlinedCircle(vecPos, vecSize, outlinedColor, width)
				break
			default:
				RendererSDK.OutlinedRect(vecPos, vecSize, width, outlinedColor)
				break
		}
		// draw texture spell / item
		RendererSDK.Image(
			texture,
			vecPos,
			isCircle,
			vecSize,
			Color.White,
			undefined,
			undefined,
			grayScale
		)
		if (cooldown === 0) {
			return
		}
		switch (modeImage) {
			case EModeImage.Round:
				RendererSDK.FilledCircle(vecPos, vecSize, Color.Black.SetA(100))
				break
			default:
				RendererSDK.FilledRect(vecPos, vecSize, Color.Black.SetA(100))
				break
		}
	}

	private textChargeOrLevel(
		value: number,
		isCharge: boolean,
		position: Rectangle,
		color: Color
	) {
		const flags = isCharge
			? TextFlags.Right | TextFlags.Top
			: TextFlags.Right | TextFlags.Bottom
		this.Text(value.toString(), position, flags, 2, color)
	}
}
