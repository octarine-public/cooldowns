const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const vm = require("node:vm")
const ts = require("typescript")

class Vector2 {
	constructor(x = 0, y = 0) { this.x = x; this.y = y }
}

class Color {
	constructor(r = 0, g = 0, b = 0, a = 255) { Object.assign(this, { r, g, b, a }) }
}
for (const [key, rgb] of Object.entries({ White: [255, 255, 255], Black: [0, 0, 0], Green: [0, 255, 0], Yellow: [255, 255, 0] })) {
	Object.defineProperty(Color, key, { get: () => new Color(...rgb) })
}

// The ticks a multiselect stores, in the order src/menu/team.ts declares its options.
const ticks = (enemies, allies, local) => [["Enemies", enemies], ["Allies", allies], ["Your hero", local]]

// A stored value as a config file holds it, so what the script built in its own realm compares.
const plain = value => JSON.parse(JSON.stringify(value))

// What each index the old dropdowns saved stood for, by the enum its readers switched on.
const expected = [
	ticks(true, true, true),
	ticks(true, true, false),
	ticks(true, false, false),
	ticks(false, true, false),
	ticks(false, true, true)
]

// Every node that carried a "Team" dropdown before the multi-selects replaced it.
const rows = [
	["Spells"], ["Items"], ["Modifiers"],
	["Modifiers", "Important"], ["Modifiers", "Auras"],
	["Modifiers", "Buffs"], ["Modifiers", "Debuffs"]
]

function nodeAt(stored, at) {
	return at.reduce((node, name) => node?.[name], stored)
}

function runtime() {
	const migrations = []
	const node = (name, stored) => ({
		Name: name, entry: { name, stored },
		SortNodes: false, TabbedChildren: false, Priority: 0,
		AddNode(label) { return node(label) },
		AddSettings(label) { return node(label) },
		AddEntry(label) { return node(label) },
		AddToggle(label, value = false) { return { value, IsHidden: false, OnValue() { return this } } },
		AddSlider(label, value = 0, min = 0, max = 100) { return { value, min, max, IsHidden: false, OnValue() { return this } } },
		AddMultiSelect() { return { IsHidden: false, IsSelected: () => true, Select() {}, OnValue() { return this } } },
		AddColorPicker(label, SelectedColor) { return { SelectedColor, IsHidden: false, SolidOnly() { return this }, OnValue() { return this } } },
		AddDropdown(label, values, SelectedID = 0) { return { values, SelectedID, IsHidden: false, OnValue(callback) { callback(this); return this } } },
		Update() {}
	})
	const icons = new Proxy({}, { get: (_, name) => String(name) })
	const context = vm.createContext({
		MenuSDK: {
			AddConfigMigration(migration) { migrations.push(migration) },
			ConfigSubtreeOf: (raw, entry) => raw?.[entry.name],
			MenuFontFamilies: () => ["Open Sans"],
			Theme: { FontFamily: "Roboto" }
		},
		Menu: { Icons: icons, AddEntry: name => node(name) },
		Vector2, Color,
		GUIInfo: { ScaleWidth: n => n, ScaleHeight: n => n },
		__OCT_PACKAGE_ROOT__: "cooldowns"
	})
	const cache = new Map()
	function load(name) {
		if (cache.has(name)) return cache.get(name).exports
		const base = path.join(__dirname, "..", name)
		const filename = fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`
		const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
		}).outputText
		const module = { exports: {} }
		cache.set(name, module)
		const evaluate = vm.runInContext(`(function(require, module, exports) {${code}\n})`, context)
		evaluate(request => load(path.posix.join(path.posix.dirname(name), request)), module, module.exports)
		return module.exports
	}
	// The root node hands the manager whatever this config already held.
	const adopt = stored => {
		const root = node("Cooldowns_v1", stored)
		const entry = node("Visual")
		entry.AddNode = () => root
		context.Menu.AddEntry = () => entry
		return load("src/menu/index").MenuManager
	}
	return { load, adopt, migrations }
}

// A config saved by the build before the migration, one team row per node that had one.
const legacy = index => ({
	State: true, Opacity: 80,
	Spells: { Team: index }, Items: { Team: index },
	Modifiers: {
		Team: index,
		Important: { Team: index }, Auras: { Team: index },
		Buffs: { Team: index }, Debuffs: { Team: index }
	}
})

test("every stored team dropdown index becomes the ticks that index stood for", () => {
	for (let index = 0; index < expected.length; index++) {
		const r = runtime()
		const stored = legacy(index)
		new (r.adopt(stored))()
		for (const at of rows) {
			assert.deepEqual(plain(nodeAt(stored, at).Team), expected[index], `${at.join("/")} at ${index}`)
		}
	}
	// The rows the general settings moved are still carried alongside the team rows.
	const r = runtime()
	const stored = legacy(2)
	new (r.adopt(stored))()
	assert.deepEqual(plain(stored.General), { State: true, Opacity: 80 })
})

test("a config loaded after start goes through the registered migration too", () => {
	const r = runtime()
	new (r.adopt(undefined))()
	assert.equal(r.migrations.length, 1)
	const raw = { Cooldowns_v1: legacy(4) }
	r.migrations[0](raw)
	for (const at of rows) {
		assert.deepEqual(plain(nodeAt(raw.Cooldowns_v1, at).Team), expected[4])
	}
	// Nothing of this script's is stored yet: the migration must not mint a subtree.
	const empty = {}
	r.migrations[0](empty)
	assert.deepEqual(plain(empty), {})
})

test("ticks already stored, and an index the dropdown never had, are left as they are", () => {
	const r = runtime()
	const Manager = r.adopt(undefined)
	const stored = legacy(0)
	stored.Spells.Team = ticks(false, false, true)
	stored.Items.Team = 5
	stored.Modifiers.Team = "Enemies"
	stored.Modifiers.Buffs.Team = -1
	const raw = { Cooldowns_v1: stored }
	new Manager()
	r.migrations[0](raw)
	assert.deepEqual(plain(stored.Spells.Team), ticks(false, false, true))
	assert.equal(stored.Items.Team, 5)
	assert.equal(stored.Modifiers.Team, "Enemies")
	assert.equal(stored.Modifiers.Buffs.Team, -1)
	assert.deepEqual(plain(stored.Modifiers.Auras.Team), expected[0])
	// Running it again over what it has already converted changes nothing.
	const carried = JSON.stringify(stored)
	r.migrations[0](raw)
	r.migrations[0](raw)
	assert.equal(JSON.stringify(stored), carried)
})

test("a row saved with its hotkeys and logic carries their captured options as sides", () => {
	const r = runtime()
	const Manager = r.adopt(undefined)
	const stored = legacy(0)
	stored.Spells.Team = {
		v: 3,
		hotkeys: [{ key: "F3", mode: "hold", value: "Only enemies" }, { key: "F4", value: "All" }],
		logic: [{ when: "after", at: 300, value: "Only allies and local" }]
	}
	// The modifier categories listed four options of their own, under the same indexes.
	stored.Modifiers.Debuffs.Team = { v: 1, hotkeys: [{ key: "F5", value: "Allies" }] }
	const raw = { Cooldowns_v1: stored }
	new Manager()
	r.migrations[0](raw)
	assert.deepEqual(plain(stored.Spells.Team.v), expected[3])
	assert.deepEqual(plain(stored.Spells.Team.hotkeys.map(hotkey => hotkey.value)), [["Enemies"], ["Enemies", "Allies", "Your hero"]])
	assert.deepEqual(plain(stored.Spells.Team.logic[0].value), ["Allies", "Your hero"])
	assert.equal(stored.Spells.Team.hotkeys[0].mode, "hold")
	assert.deepEqual(plain(stored.Modifiers.Debuffs.Team.v), expected[1])
	assert.deepEqual(plain(stored.Modifiers.Debuffs.Team.hotkeys[0].value), ["Enemies"])
	const carried = JSON.stringify(stored)
	r.migrations[0](raw)
	assert.equal(JSON.stringify(stored), carried)
})
