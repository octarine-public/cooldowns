/**
 * The grade an icon's art is washed in: grayed, then graded from black through `mid` at a mid
 * gray up to `top` at white. A multiply by a colour is the grade through half that colour to
 * the colour itself; a grade through a light tone to a lighter one keeps the art as bright as
 * it was and only recolours it.
 */
export interface ArtWash {
	readonly mid: Color
	readonly top: Color
}

/** A decoded icon: luminance and alpha per pixel, row by row. */
export interface GrayImage {
	readonly width: number
	readonly height: number
	readonly luma: Uint8Array
	readonly alpha: Uint8Array
	/** Original colours, retained only when the preview needs a full-colour copy. */
	readonly rgba?: Uint8Array
}

/** What the strip's own canvas paints an icon with, over what the SDK's canvas offers. */
export interface HudImageStyle extends MenuSDK.CanvasImageStyle {
	/**
	 * A wash the art is drawn in, the way the game's HUD washes an icon its owner cannot pay
	 * for: grayed first, then coloured, so a black of the art stays black. Implies `grayscale`;
	 * `color` still fades it. The graying is a copy of the art's pixels, so it is only had for
	 * the game's own textures, and anything else is tinted in the wash's top colour as it is.
	 */
	readonly wash?: ArtWash
	/**
	 * The game texture the washed copy is cut from, when the art itself is not one: the preview
	 * draws icons of its own, and still washes the game's.
	 */
	readonly washSource?: string
}

export type GuiCanvas = Pick<MenuSDK.Canvas, "Rect" | "Circle" | "Arc"> & {
	/** Paints an image cut to the box, tinted, grayed or washed. */
	Image(path: string, position: Vector2, size: Vector2, style?: HudImageStyle): void
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
> & {
	/** The game texture a wash of the icon is cut from, where the icon drawn is not one. */
	readonly WashSource?: string
}

export type ItemDisplay = Pick<
	Item,
	| "Cooldown"
	| "DisplayCharges"
	| "TexturePath"
	| "HasBehavior"
	| "IsMuted"
	| "IsManaEnough"
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
