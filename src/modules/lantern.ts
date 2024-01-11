import { Modifier } from "github.com/octarine-public/wrapper/index"

import { LanternGUI } from "../gui/lantern"
import { LanternMenu } from "../menu/lantern"

export class LanternManager {
	private readonly gui = new LanternGUI()
	private readonly modifiers: Modifier[] = []
	private readonly buffNames = ["modifier_lamp_on", "modifier_lamp_off"]

	constructor(private readonly menu: LanternMenu) {}

	private get state() {
		return this.menu.State.value
	}

	public Draw() {
		if (!this.state || this.gui.IsPostGame || !this.gui.IsInGameUI) {
			return
		}
		for (let index = this.modifiers.length - 1; index > -1; index--) {
			const modifier = this.modifiers[index]
			const owner = modifier.Parent
			const caster = modifier.Caster
			const remainingTime = modifier.RemainingTime
			if (!remainingTime || owner === undefined || caster === undefined) {
				continue
			}
			this.gui.Draw(
				owner.Position,
				remainingTime,
				caster.Name,
				this.menu.Size.value
			)
		}
	}

	public ModifierCreated(modifier: Modifier) {
		if (this.buffNames.includes(modifier.Name)) {
			this.modifiers.push(modifier)
		}
	}

	public ModifierRemoved(modifier: Modifier) {
		if (this.buffNames.includes(modifier.Name)) {
			this.modifiers.remove(modifier)
		}
	}
}
