export type GuiCanvas = Pick<MenuSDK.Canvas, "Rect" | "Circle" | "Image" | "Arc"> & {
	/** Counts a box drawn on another surface into this one's bounds, which frame and drag it. */
	Reserve(position: Vector2, size: Vector2): void
}

export const enum ETextEffect {
	None,
	Shadow,
	Outline,
	SoftShadow
}

export interface StyledText extends Omit<MenuSDK.IHudText, "effect"> {
	effect: ETextEffect
	effectColor: number
}

export interface TextSurface {
	Push(command: StyledText): void
}

export type SpellDisplay = Pick<
	Ability,
	| "Cooldown"
	| "TexturePath"
	| "CurrentCharges"
	| "Level"
	| "MaxLevel"
	| "IsActivated"
	| "IsManaEnough"
	| "IsInAbilityPhase"
	| "IsChanneling"
	| "AltCastState"
	| "HasBehavior"
	| "IsPassive"
	| "Owner"
>

export type ItemDisplay = Pick<
	Item,
	"Cooldown" | "CurrentCharges" | "TexturePath" | "HasBehavior" | "IsMuted"
>

export type ModifierDisplay = Pick<
	Modifier,
	| "StackCount"
	| "RemainingTime"
	| "Duration"
	| "Name"
	| "GetTexturePath"
	| "ForceVisible"
	| "IsEnemy"
	| "Caster"
> & {
	IsShield(): boolean
	IsBuff(): boolean
	IsChannel(): boolean
}
