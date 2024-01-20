import {
	GUIInfo,
	Modifier,
	TickSleeper,
	Vector2
} from "github.com/octarine-public/wrapper/index"

import { ModifierMenu } from "../menu/modifiers"
import { BaseGUI } from "./index"

export class ModifierGUI extends BaseGUI {
	private static readonly minSize = 16
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
		_menu: ModifierMenu,
		modifiers: Modifier[],
		_additionalPosition: Vector2
	): void {
		const newModifiers = this.GetModifiers(modifiers)

		this.Log(newModifiers)

		for (let index = newModifiers.length - 1; index > -1; index--) {
			const modifier = newModifiers[index]
		}
	}

	private GetModifiers(modifiers: Modifier[]): Modifier[] {
		const maxModifiers = 1

		return modifiers.filter((_, i) => i >= maxModifiers) // TODO
	}

	private readonly sleeper = new TickSleeper()
	private Log(...args: any[]): void {
		if (!this.sleeper.Sleeping) {
			console.log(...args)
			this.sleeper.Sleep(1000)
		}
	}
}
