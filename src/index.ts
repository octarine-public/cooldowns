import "./translations"

import {
	Entity,
	EventsSDK,
	Modifier,
	Unit
} from "github.com/octarine-public/wrapper/index"

import { MenuManager } from "./menu/index"
import { RespawnManager } from "./modules/respawn"
import { SpellManager } from "./modules/spells"

const bootstrap = new (class CCooldowns {
	private readonly menuManager = new MenuManager()
	private readonly spellManager = new SpellManager(this.menuManager)
	private readonly respawnManager = new RespawnManager(this.menuManager.RespawnMenu)

	protected get State() {
		return this.menuManager.State.value
	}

	public Draw() {
		if (this.State) {
			this.spellManager.Draw()
			this.respawnManager.Draw()
		}
	}

	public EntityCreated(_entity: Entity) {
		/** @todo */
	}

	public EntityDestroyed(_entity: Entity) {
		/** @todo */
	}

	public UnitPropertyChanged(unit: Unit) {
		this.spellManager.UnitPropertyChanged(unit)
	}

	public ModifierCreated(_modifier: Modifier) {
		/** @todo */
	}

	public ModifierChanged(_modifier: Modifier) {
		/** @todo */
	}

	public ModifierRemoved(_modifier: Modifier) {
		/** @todo */
	}
})()

EventsSDK.on("Draw", () => bootstrap.Draw())

EventsSDK.on("EntityCreated", entity => bootstrap.EntityCreated(entity))

EventsSDK.on("EntityDestroyed", entity => bootstrap.EntityCreated(entity))

EventsSDK.on("ModifierCreated", modifier => bootstrap.ModifierCreated(modifier))

EventsSDK.on("ModifierChanged", modifier => bootstrap.ModifierChanged(modifier))

EventsSDK.on("ModifierRemoved", modifier => bootstrap.ModifierRemoved(modifier))

EventsSDK.on("UnitPropertyChanged", entity => bootstrap.UnitPropertyChanged(entity))
