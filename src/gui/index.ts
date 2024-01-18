import {
	Ability,
	Color,
	GUIInfo,
	invoker_exort,
	invoker_quas,
	invoker_wex,
	Item,
	npc_dota_hero_doom_bringer,
	npc_dota_hero_invoker,
	npc_dota_hero_rubick,
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
	private static readonly fontWidth = 500
	private static readonly minItemSize = 16
	private static readonly minSpellSize = 18
	private static readonly itemOutlineColor = new Color(35, 38, 40)
	private static readonly noManaOutlineColor = new Color(77, 131, 247)

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
			this.itemSize.CopyFrom(GUIInfo.ScaleVector(itemSize * (88 / 64), itemSize))
		}
	}

	public DrawSpells(
		menu: SpellMenu,
		isDisable: boolean,
		spells: Ability[],
		additionalPosition: Vector2
	) {
		const vecSize = this.spellSize,
			recPosition = this.position,
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1) // 2 + 1

		for (let index = spells.length - 1; index > -1; index--) {
			const spell = spells[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				spells.length,
				index,
				additionalPosition
			)
			// hide item if contains dota hud
			if (GUIInfo.Contains(vecPos)) {
				continue
			}
			// width of outlined
			const position = new Rectangle(vecPos, vecPos.Add(vecSize))
			const cooldown = spell.Cooldown,
				texture = spell.TexturePath,
				currCharges = spell.CurrentCharges,
				noMana = (spell.Owner?.Mana ?? 0) < spell.ManaCost,
				modeImage = menu.ModeImage.SelectedID

			if (modeImage === EModeImage.Minimilistic) {
				this.Minimilistic(
					spell,
					vecPos,
					vecSize,
					border,
					position,
					cooldown,
					modeImage,
					isDisable,
					noMana
				)
			} else {
				this.Image(
					texture,
					vecPos,
					vecSize,
					border,
					cooldown,
					modeImage,
					spell.Level === 0 || isDisable,
					spell.IsInAbilityPhase || spell.IsChanneling,
					isDisable,
					noMana
				)
			}

			const levelType = menu.LevelType.SelectedID,
				levelColor = menu.LevelColor.SelectedColor,
				chargeColor = menu.ChargeColor.SelectedColor

			// draw charges
			if (currCharges !== 0) {
				this.textChargeOrLevel(currCharges, true, position, chargeColor)
			}

			switch (levelType) {
				case ELevelType.Square:
					// draw level by square
					this.SquareLevel(spell, vecPos, vecSize, levelColor)
					break
				default: {
					// draw level by text
					this.textChargeOrLevel(spell.Level, false, position, levelColor)
					break
				}
			}

			// draw cooldown text
			if (cooldown !== 0) {
				const cdText = cooldown.toFixed(cooldown <= 3 ? 1 : 0)
				this.Text(cdText, position, TextFlags.Center)
			}
		}
	}

	public DrawItems(
		_menu: ItemMenu,
		_isDisabled: boolean,
		items: Item[],
		additionalPosition: Vector2
	) {
		const baseSize = this.itemSize
		const recPosition = this.position
		const border = GUIInfo.ScaleHeight(BaseGUI.border / 2)

		for (let index = items.length - 1; index > -1; index--) {
			const item = items[index]
			const vecPosition = this.GetPosition(
				recPosition,
				baseSize,
				border,
				items.length,
				index,
				additionalPosition
			)
			// hide item if contains dota hud
			if (GUIInfo.Contains(vecPosition)) {
				continue
			}
			this.SquareItems(item, vecPosition, baseSize, border)
		}
	}

	protected Minimilistic(
		spell: Ability,
		vecPos: Vector2,
		vecSize: Vector2,
		width: number,
		position: Rectangle,
		cooldown: number,
		modeImage: EModeImage,
		isDisable: boolean,
		noMana: boolean
	) {
		const minimalistic = position.Clone(),
			ignoreMinimalistic = this.ignoreSpellMinimalistic(spell),
			outlinedColor = noMana
				? BaseGUI.noManaOutlineColor.SetA(180)
				: Color.Black.SetA(180)

		if (cooldown === 0) {
			minimalistic.Height /= 4
			minimalistic.y += position.Width - minimalistic.Height
		}

		if (cooldown === 0 || !ignoreMinimalistic) {
			RendererSDK.FilledRect(minimalistic.pos1, minimalistic.Size, outlinedColor)
			return
		}

		const texture = spell.TexturePath,
			grayScale = spell.Level === 0 || isDisable,
			isInPhase = spell.IsInAbilityPhase || spell.IsChanneling

		this.Image(
			texture,
			vecPos,
			vecSize,
			width,
			cooldown,
			modeImage,
			grayScale,
			isInPhase,
			isDisable,
			noMana
		)
	}

	protected SquareItems(item: Item, vecPos: Vector2, vecSize: Vector2, border: number) {
		const cooldown = item.Cooldown,
			charge = item.CurrentCharges

		// draw image item
		RendererSDK.Image(item.TexturePath, vecPos, -1, vecSize)

		// draw outline
		RendererSDK.OutlinedRect(
			vecPos,
			vecSize,
			Math.round(border),
			BaseGUI.itemOutlineColor
		)

		if (!charge && !cooldown) {
			return
		}

		const position = new Rectangle(vecPos, vecPos.Add(vecSize))
		if (charge !== 0) {
			const charges = charge.toString()
			this.Text(charges, position, TextFlags.Right | TextFlags.Bottom)
		}

		if (cooldown !== 0) {
			// if no charge draw cooldown by center
			const noCharge = charge === 0
			const flags = noCharge ? TextFlags.Center : TextFlags.Left | TextFlags.Top
			const cdText = cooldown.toFixed(cooldown <= 10 ? 1 : 0)

			// TODO: add text scale right offset
			this.Text(cdText, position, flags)
		}
	}

	protected Text(
		text: string,
		position: Rectangle,
		flags: TextFlags,
		division = 2,
		color = Color.White
	) {
		RendererSDK.TextByFlags(text, position, color, division, flags, BaseGUI.fontWidth)
	}

	protected GetPosition(
		rec: Rectangle,
		size: Vector2,
		border: number,
		count: number,
		index: number,
		additionalPosition: Vector2
	) {
		const posX = rec.x + (rec.Width + border) / 2
		const posY = rec.y - size.y - border * 2
		return new Vector2(posX, posY)
			.SubtractScalarX(((size.x + border) * count) / 2)
			.AddScalarX(index * (size.x + border))
			.AddForThis(additionalPosition)
			.RoundForThis()
	}

	protected SquareLevel(
		spell: Ability,
		vecPos: Vector2,
		vecSize: Vector2,
		levelColor: Color
	) {
		const currLvl = spell.Level
		if (spell.MaxLevel === 0 || spell.Level === 0) {
			return
		}

		const position = new Rectangle(vecPos, vecPos.Add(vecSize))
		// if invoker abilities draw level by text
		if (
			spell instanceof invoker_wex ||
			spell instanceof invoker_quas ||
			spell instanceof invoker_exort
		) {
			this.Text(currLvl.toString(), position, TextFlags.Right | TextFlags.Bottom)
			return
		}

		const squarePosition = position.Clone()

		squarePosition.Height /= 4
		squarePosition.y += squarePosition.Width - squarePosition.Height

		// debug
		// RendererSDK.FilledRect(imagePosition.pos1, imagePosition.Size, Color.Red)

		const border = GUIInfo.ScaleHeight(1)
		const boxOffset = squarePosition.Height * 0.75

		const size = new Vector2(boxOffset, boxOffset)
		for (let index = 0; index < currLvl; index++) {
			const center = new Vector2(
				squarePosition.x + border + Math.floor(squarePosition.Width / 2),
				squarePosition.y + border
			)
				.SubtractScalarX(((size.x + border) * currLvl) / 2)
				.AddScalarX(index * (size.x + border))
				.FloorForThis()

			RendererSDK.FilledRect(center, size, levelColor)
			RendererSDK.OutlinedRect(center, size, size.y / 2, Color.Black)
		}
	}

	// TODO: add no mana engoy color
	protected Image(
		texture: string,
		vecPos: Vector2,
		vecSize: Vector2,
		border: number,
		cooldown: number,
		modeImage: EModeImage,
		grayScale: boolean,
		isInPhase?: boolean,
		isDisable?: boolean,
		noMana?: boolean
	) {
		let outlinedColor = Color.Black
		const isCircle = modeImage === EModeImage.Round ? 0 : -1

		// color for outline
		switch (true) {
			case noMana:
				outlinedColor = BaseGUI.noManaOutlineColor
				break
			case isInPhase:
				outlinedColor = Color.Green
				break
			case cooldown !== 0 || isDisable:
				outlinedColor = Color.Red
				break
			default:
				outlinedColor = Color.Black
				break
		}

		// draw outline
		switch (modeImage) {
			case EModeImage.Round:
				RendererSDK.OutlinedCircle(
					vecPos,
					vecSize,
					outlinedColor,
					Math.round(border)
				)
				break
			default:
				RendererSDK.OutlinedRect(
					vecPos,
					vecSize,
					Math.round(border),
					outlinedColor
				)
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
		if (value === 0) {
			return
		}
		const flags = isCharge
			? TextFlags.Right | TextFlags.Top
			: TextFlags.Right | TextFlags.Bottom
		this.Text(value.toString(), position, flags, 2, color)
	}

	private ignoreSpellMinimalistic(spell: Ability) {
		const owner = spell.Owner
		if (owner === undefined || owner.IsNeutral) {
			return false
		}
		if (
			owner instanceof npc_dota_hero_rubick ||
			owner instanceof npc_dota_hero_invoker ||
			owner instanceof npc_dota_hero_doom_bringer
		) {
			return spell.AbilitySlot >= 3 && spell.AbilitySlot <= 4
		}
		return false
	}
}
