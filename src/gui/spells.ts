import {
	Ability,
	Color,
	DOTA_ABILITY_BEHAVIOR,
	EAbilitySlot,
	GUIInfo,
	npc_dota_hero_doom_bringer,
	npc_dota_hero_invoker,
	npc_dota_hero_rubick,
	Rectangle,
	RendererSDK,
	TextFlags,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ELevelType } from "../enum"
import { SpellMenu } from "../menu/spells"
import { BaseGUI } from "./index"

export class SpellGUI extends BaseGUI {
	private static readonly minSize = 17
	private readonly size = new Vector2()

	public Update(
		position: Nullable<Vector2>,
		positionEnd: Nullable<Vector2>,
		healthBarSize: Vector2,
		additionalSize: number,
		scale: number
	) {
		super.Update(position, positionEnd, healthBarSize, additionalSize, scale)
		const size = SpellGUI.minSize + additionalSize * 4
		this.size.CopyFrom(GUIInfo.ScaleVector(size * scale, size * scale))
		this.size.x -= (this.size.x + 1) % 2
		this.size.y -= (this.size.y + 1) % 2
	}
	public Draw(
		mainAlpha: number,
		menu: SpellMenu,
		spells: [Ability, number][],
		additionalPosition: Vector2,
		isSilenced: boolean,
		isPassiveDisabled: boolean
	): void {
		this.DrawSpells(
			this.position,
			mainAlpha,
			menu,
			spells,
			additionalPosition,
			isSilenced,
			isPassiveDisabled
		)
		this.DrawSpells(
			this.positionEnd,
			mainAlpha,
			menu,
			spells,
			additionalPosition,
			isSilenced,
			isPassiveDisabled
		)
	}
	protected DrawSpells(
		recPosition: Rectangle,
		mainAlpha: number,
		menu: SpellMenu,
		spells: [Ability, number][],
		additionalPosition: Vector2,
		isSilenced: boolean,
		isPassiveDisabled: boolean
	) {
		// hide item if contains dota hud
		if (!recPosition.pos1.IsValid || this.Contains()) {
			return
		}
		const vecSize = this.size,
			border = GUIInfo.ScaleHeight(BaseGUI.border + 1) // 2 + 1
		for (let index = spells.length - 1; index > -1; index--) {
			const [spell, idx] = spells[index]
			const vecPos = this.GetPosition(
				recPosition,
				vecSize,
				border,
				index,
				additionalPosition,
				false, // vertical
				spells.length
			)

			const alpha = this.GetAlpha(mainAlpha, vecPos, vecSize)

			// width of outlined
			const position = new Rectangle(vecPos.Clone(), vecPos.Add(vecSize))
			const cooldown = spell.Cooldown,
				texture = spell.TexturePath,
				currCharges = spell.CurrentCharges,
				grayScale = spell.Level === 0 || !spell.IsActivated,
				noMana = !spell.IsManaEnough(),
				isInPhase = spell.IsInAbilityPhase || spell.IsChanneling,
				rounding = this.GetRounding(menu, vecSize),
				isAltCastState = spell.AltCastState,
				hasRootDisable = spell.HasBehavior(
					DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
				)
			let isDisabled = false,
				isUniqueDisabled = false
			if (spell.IsPassive) {
				isDisabled = isPassiveDisabled
			}
			if (hasRootDisable) {
				isUniqueDisabled = spell.Owner?.IsTethered ?? false
			}
			if (menu.IsMinimalistic.value) {
				this.minimilistic(
					idx,
					alpha,
					spell,
					vecPos,
					vecSize,
					rounding,
					border,
					position,
					cooldown,
					isSilenced || isUniqueDisabled,
					isDisabled,
					noMana,
					isAltCastState
				)
			} else {
				this.image(
					alpha,
					texture,
					vecPos,
					vecSize,
					rounding,
					border + +(rounding > 0),
					cooldown,
					grayScale,
					isInPhase,
					isSilenced || isUniqueDisabled,
					isDisabled,
					noMana,
					isAltCastState,
					spell.IsPassive
				)
			}

			const levelType = menu.LevelType.SelectedID,
				alphaCorrect = Math.min(alpha * 1.75, 255),
				levelColor = menu.LevelColor.SelectedColor.Clone().SetA(alphaCorrect),
				chargeColor = menu.ChargeColor.SelectedColor.Clone().SetA(alphaCorrect)

			// draw charges
			if (currCharges !== 0) {
				this.textChargeOrLevel(currCharges, true, position, chargeColor)
			}

			switch (levelType) {
				case ELevelType.Square:
					this.squareLevel(
						spell,
						vecPos,
						vecSize,
						menu.IsMinimalistic.value,
						levelColor,
						Color.Black.SetA(alpha)
					)
					break
				default: {
					this.textChargeOrLevel(spell.Level, false, position, levelColor)
					break
				}
			}

			if (cooldown !== 0) {
				const cdText = cooldown.toFixed(cooldown <= 3 ? 1 : 0)
				this.Text(cdText, position, TextFlags.Center)
			}
		}
	}
	private minimilistic(
		idx: number,
		alpha: number,
		spell: Ability,
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		width: number,
		position: Rectangle,
		cooldown: number,
		isSilenced: boolean,
		isPassiveDisabled: boolean,
		noMana: boolean,
		isAltCastState: boolean
	) {
		const minimalistic = position.Clone(),
			ignoreMinimalistic = this.ignoreMinimalistic(spell, idx),
			outlinedColor = noMana
				? BaseGUI.noManaOutlineColor.SetA(180)
				: Color.Black.SetA(180)

		if (cooldown === 0) {
			minimalistic.Height /= 4
			minimalistic.y +=
				position.Width -
				minimalistic.Height * 0.75 -
				Math.max(GUIInfo.ScaleHeight(1), 1)
		}

		if (cooldown === 0 || !ignoreMinimalistic) {
			RendererSDK.FilledRect(minimalistic.pos1, minimalistic.Size, outlinedColor)
			return
		}
		let isDisabled = false,
			isUniqueDisabled = false
		if (spell.IsPassive) {
			isDisabled = isPassiveDisabled
		}
		const texture = spell.TexturePath,
			grayScale = spell.Level === 0 || isSilenced || !spell.IsActivated,
			isInPhase = spell.IsInAbilityPhase || spell.IsChanneling,
			hasRootDisable = spell.HasBehavior(
				DOTA_ABILITY_BEHAVIOR.DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES
			)
		if (hasRootDisable) {
			isUniqueDisabled = spell.Owner?.IsTethered ?? false
		}
		this.image(
			alpha,
			texture,
			vecPos,
			vecSize,
			rounding,
			width,
			cooldown,
			grayScale,
			isInPhase,
			isSilenced || isUniqueDisabled,
			isDisabled,
			noMana,
			isAltCastState,
			spell.IsPassive
		)
	}
	private image(
		alpha: number,
		texture: string,
		vecPos: Vector2,
		vecSize: Vector2,
		rounding: number,
		border: number,
		cooldown: number,
		grayScale: boolean,
		isInPhase?: boolean,
		isUniqueDisabled?: boolean,
		isPassiveDisabled?: boolean,
		noMana?: boolean,
		isAltCastState?: boolean,
		isPassive?: boolean
	) {
		let outlinedColor = Color.Black
		const noManaColor = BaseGUI.noManaOutlineColor.Clone()
		if (noMana) {
			outlinedColor = noManaColor.Clone()
		} else if (isAltCastState) {
			outlinedColor = Color.Aqua
		} else if (isInPhase) {
			outlinedColor = Color.Green
		} else if (
			cooldown !== 0 ||
			(isUniqueDisabled && !isPassive) ||
			isPassiveDisabled
		) {
			outlinedColor = Color.Red
		}

		RendererSDK.RectRounded(
			vecPos,
			vecSize,
			rounding,
			Color.fromUint32(0),
			outlinedColor.SetA(alpha),
			Math.round(border)
		)

		RendererSDK.Image(
			texture,
			vecPos,
			rounding,
			vecSize,
			(noMana ? noManaColor.Clone() : Color.White).SetA(alpha),
			undefined,
			undefined,
			grayScale
		)
		if (isPassiveDisabled) {
			this.ImageMask(vecPos, vecSize, rounding, false)
		}
		if (isUniqueDisabled && !isPassive) {
			this.ImageMask(vecPos, vecSize, rounding, true)
		}
		if (cooldown === 0) {
			return
		}
		RendererSDK.RectRounded(
			vecPos,
			vecSize,
			rounding,
			Color.Black.SetA(alpha * (100 / 255)),
			Color.fromUint32(0),
			1
		)
	}
	private squareLevel(
		spell: Ability,
		vecPos: Vector2,
		vecSize: Vector2,
		minimalistic: boolean,
		levelColor: Color,
		outlineColor: Color
	) {
		const currLvl = spell.Level
		if (spell.MaxLevel === 0 || currLvl === 0) {
			return
		}

		const position = new Rectangle(vecPos.Clone(), vecPos.Add(vecSize))
		if (currLvl >= 5) {
			this.Text(
				currLvl.toString(),
				position,
				TextFlags.Right | TextFlags.Bottom,
				2,
				levelColor
			)
			return
		}

		const fillColor = !(minimalistic && !spell.IsManaEnough())
			? levelColor
			: BaseGUI.noManaOutlineColor

		const borderThickness = Math.max(GUIInfo.ScaleHeight(1), 1)
		const maxLvl = 4
		const step = ((vecSize.x + borderThickness * 2) / maxLvl) | 0
		const borderSize = new Vector2(borderThickness, borderThickness)
		const squareSize = new Vector2(step, Math.round(step * (1 / 2))).Add(borderSize)

		const pos = position.pos1
			.Clone()
			.AddScalarX((vecSize.x - (step * maxLvl + borderThickness)) / 2) // 1px fix
			.AddScalarX(step * (maxLvl - currLvl) * 0.5) // center
			.AddScalarY(position.Size.y - squareSize.y)

		for (let i = 0; i < currLvl; i++) {
			RendererSDK.FilledRect(pos, squareSize, outlineColor)
			RendererSDK.FilledRect(
				pos.Add(borderSize),
				squareSize.Subtract(borderSize.MultiplyScalar(2)),
				fillColor
			)
			pos.AddScalarX(step)
		}
	}
	private ignoreMinimalistic(spell: Ability, idx: number) {
		const owner = spell.Owner
		if (owner === undefined || owner.IsNeutral) {
			return false
		}
		if (
			owner instanceof npc_dota_hero_rubick ||
			owner instanceof npc_dota_hero_invoker ||
			owner instanceof npc_dota_hero_doom_bringer
		) {
			return (
				idx === EAbilitySlot.DOTA_SPELL_SLOT_4 ||
				idx === EAbilitySlot.DOTA_SPELL_SLOT_5
			)
		}
		return false
	}
}
