import { Ability, Unit } from "github.com/octarine-public/wrapper/index"

export class SpellData {
	public Spells: Ability[] = []

	constructor(public readonly Owner: Unit) {}

	public Draw() {
		/** */
	}
}
