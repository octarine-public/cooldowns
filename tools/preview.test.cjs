const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const vm = require("node:vm")
const ts = require("typescript")

class Vector2 {
	constructor(x = 0, y = 0) { this.x = x; this.y = y }
	get IsValid() { return Number.isFinite(this.x) && Number.isFinite(this.y) }
	Clone() { return new Vector2(this.x, this.y) }
	CopyFrom(value) { this.x = value.x; this.y = value.y; return this }
	Invalidate() { this.x = this.y = NaN }
	Add(value) { return new Vector2(this.x + value.x, this.y + value.y) }
	AddScalar(value) { return new Vector2(this.x + value, this.y + value) }
	SetVector(x, y) { this.x = x; this.y = y; return this }
	AddForThis(value) { return this.CopyFrom(this.Add(value)) }
	AddScalarX(value) { this.x += value; return this }
	AddScalarY(value) { this.y += value; return this }
	Subtract(value) { return new Vector2(this.x - value.x, this.y - value.y) }
	SubtractScalarX(value) { this.x -= value; return this }
	MultiplyScalar(value) { return new Vector2(this.x * value, this.y * value) }
	DivideScalar(value) { return new Vector2(this.x / value, this.y / value) }
	RoundForThis() { this.x = Math.round(this.x); this.y = Math.round(this.y); return this }
	Distance(value) { return Math.hypot(this.x - value.x, this.y - value.y) }
}

class Rectangle {
	constructor(pos1 = new Vector2(), pos2 = new Vector2()) { this.pos1 = pos1; this.pos2 = pos2 }
	get x() { return this.pos1.x }
	get y() { return this.pos1.y }
	set y(value) { const height = this.Height; this.pos1.y = value; this.pos2.y = value + height }
	get Width() { return this.pos2.x - this.x }
	get Height() { return this.pos2.y - this.y }
	set Height(value) { this.pos2.y = this.y + value }
	get Size() { return this.pos2.Subtract(this.pos1) }
	Clone() { return new Rectangle(this.pos1.Clone(), this.pos2.Clone()) }
	Add(value) { this.pos1.AddForThis(value); this.pos2.AddForThis(value); return this }
}

class Color {
	constructor(r = 0, g = 0, b = 0, a = 255) { Object.assign(this, { r, g, b, a }) }
	// The packed value every channel reads and writes, as the SDK's Color carries it.
	get data32() { return (((this.a << 24) | (this.b << 16) | (this.g << 8) | this.r) >>> 0) }
	Clone() { return new Color(this.r, this.g, this.b, this.a) }
	SetA(value) { this.a = value; return this }
	static fromUint32() { return new Color(0, 0, 0, 0) }
}
for (const [key, rgb] of Object.entries({ White: [255, 255, 255], Black: [0, 0, 0], Green: [0, 255, 0], Yellow: [255, 255, 0], Red: [255, 0, 0], Aqua: [0, 255, 255] })) {
	Object.defineProperty(Color, key, { get: () => new Color(...rgb) })
}
// The SDK's shared read-only instances, handed out instead of minting a colour per call.
Color.WhiteReadonly = new Color(255, 255, 255)
Color.ZeroReadonly = new Color(0, 0, 0, 0)

function runtime(ratio = 1, gameScale = 1, seed) {
	let move, end, opened, activePage, released = 0, now = 1
	const listeners = new Map()
	const input = {
		on(name, handler) { const handlers = listeners.get(name) ?? new Set(); handlers.add(handler); listeners.set(name, handlers) },
		removeListener(name, handler) { listeners.get(name)?.delete(handler) },
		emit(name, key) { for (const handler of listeners.get(name) ?? []) { if (handler(key) === false) return false } return true }
	}
	const document = { createElement: tag => ({ tagName: tag, ownerDocument: document, style: {}, children: [], appendChild(child) { this.children.push(child) } }) }
	const makeElement = () => document.createElement("div")
	const sdk = {
		PreviewMotion: { value: true }, PreviewClock: () => now, DrawClock: () => now,
		HudColors: { accent: new Color(94, 160, 255) },
		DpToPx: value => value * ratio, ToLayoutUnits: value => value / ratio,
		HostCursorPosition: () => [0, 0],
		Localization: { Localize: text => text },
		BeginDrag(nextMove, nextEnd) { move = nextMove; end = nextEnd },
		EndDrag() { const done = end; end = move = undefined; done?.() },
		OpenElementSettings(node) { opened = { node } },
		OpenGroupedSettings(node, frame, sections) { opened = { node, frame, sections } },
		CloseElementSettings() { opened = undefined },
		ElementSettingsNode: () => opened?.node,
		ActiveContentNode: () => activePage,
		HideChipTooltip() {}, RefreshPanels() {},
		Theme: { FontFamily: "Roboto" }, Tokens: { Accent: "#abcdef", StatusGood: "#00ff00", PanelBorder: "#000000" },
		EHudTextEffect: { None: 0, Shadow: 1, Outline: 2 },
		MenuFontWeight: weight => weight,
		MenuFontFamilies: () => ["Open Sans"],
		MeasureTextPx: (text, size) => [text.length * size / 2, size],
		HudColor: (color, alpha) => ((color.r << 24) | (color.g << 16) | (color.b << 8) | alpha) >>> 0,
		CssColor: color => `rgba(${color.r},${color.g},${color.b},${color.a})`,
		HexOf: color => color,
		SdfShape: (...values) => ({ decorator: JSON.stringify(values) }),
		ImageSize: () => new Vector2(64, 64),
		HostImageReady: () => true,
		WriteSizedArt(element, source) { element.source = source },
		ReleaseSizedArt() { released++ },
		WritePx(element, name, value) { element.style[name] = value },
		WriteFmt(element, name, value, suffix) { element.style[name] = `${value}${suffix}` },
		WriteStyle(element, name, value) { element.style[name] = value },
		WriteShown(element, shown) { element.shown = shown },
		WriteText(element, text) { element.text = text },
		applyStyle(element, style) { Object.assign(element.style, style) }
	}
	const unitModels = new Map()
	const gameFiles = new Map()
	const wearables = new Map()
	const icons = new Proxy({}, { get: (_, name) => String(name) })
	const context = vm.createContext({
		React: { Fragment: "fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }) },
		MenuSDK: sdk, Menu: { Icons: icons }, Vector2, Rectangle, Color,
		InputEventSDK: input, VKeys: { LEFT: 37 }, hrtime: () => now * 1000,
		Math: Object.assign(Object.create(Math), { clamp: (n, min, max) => Math.min(Math.max(n, min), max) }),
		GUIInfo: {
			ScaleWidth: n => n * gameScale, ScaleHeight: n => n * gameScale,
			ScaleVector: (x, y) => new Vector2(x * gameScale, y * gameScale),
			ContainsShop: () => false, ContainsMiniMap: () => false, ContainsScoreboard: () => false
		},
		InputManager: { CursorOnScreen: new Vector2() },
		AbilityData: { GetAbilityByName: () => undefined },
		// the host reads the game's own files; a test gives it whichever roster it is examining
		parseKV: path => gameFiles.get(path) ?? new Map(),
		// The unit data a joined server hands the script; empty until a test says otherwise.
		UnitData: { GetUnitDataByName: name => unitModels.has(name) ? { ModelName: unitModels.get(name) } : undefined },
		// the SDK reads the econ file; a test names the default items it hands back
		WearableData: { DefaultWearables: hero => wearables.get(hero) ?? [] },
		PathData: { ItemImagePath: "items", AbilityImagePath: "spells", HeroIconsPath: "heroes/icons" },
		TextFlags: { Top: 1, Center: 2, Bottom: 4, Left: 8, Right: 16 },
		DOTA_ABILITY_BEHAVIOR: { DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES: 1 },
		__OCT_PACKAGE_ROOT__: "cooldowns"
	})
	// which files the game ships: the package's own are looked up on disk, and the game's are
	// all there unless a test names the ones it does not
	const missingArt = new Set()
	context.fexists = source => source.startsWith("cooldowns/")
		? fs.existsSync(path.join(__dirname, "..", source.slice("cooldowns/".length)))
		: !missingArt.has(source)
	// KeyValues as the host hands them back, built INSIDE the script's realm: a map minted out
	// here is not an instance of the Map the script tests against
	const makeMap = vm.runInContext("entries => new Map(entries)", context)
	const kv = entries => makeMap(Object.entries(entries))
	// The SDK canvas the preview draws its round modifiers on, keeping every call it takes.
	const timers = { calls: [] }
	for (const name of ["Circle", "Image", "Arc", "CircleTimer", "TextIn"]) timers[name] = (...values) => { timers.calls.push([name, ...values]) }
	const cache = new Map()
	function load(name) {
		if (name === "render") return { canvas: {}, surface: {}, previewCanvas: timers }
		if (cache.has(name)) return cache.get(name).exports
		const base = path.join(__dirname, "..", name)
		const filename = fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`
		const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }
		}).outputText
		const module = { exports: {} }
		cache.set(name, module)
		const evaluate = vm.runInContext(`(function(require, module, exports) {${code}\n})`, context)
		evaluate(request => load(path.posix.join(path.posix.dirname(name), request)), module, module.exports)
		return module.exports
	}
	const slider = (value, min = -250, max = 250) => ({ value, min, max })
	const team = () => { const selected = new Set([0]); return { IsSelected: n => selected.has(n), Select(n, on) { on ? selected.add(n) : selected.delete(n) } } }
	const node = (name, parent) => ({
		Name: name, entry: { name, parent: parent?.entry },
		AddNode(label) { return node(label, this) },
		AddSettings(label) { return node(label, this) },
		AddToggle(label, value = false) { return { label, value, IsVisible: true, OnValue(callback) { this.changed = callback; callback(); return this } } },
		AddSlider(label, value, min, max) { return slider(value, min, max) },
		AddMultiSelect() { return team() },
		AddColorPicker(label, SelectedColor) { return { SelectedColor, SolidOnly() { return this } } },
		Update() {},
		AddDropdown(label, values, SelectedID = 0) { return { label, values, SelectedID, executeOnAdd: true, IsVisible: true, icons: [],
			SetOptionIcons(icons) { this.icons = icons; return this },
			OnValue(callback) { this.changed = callback; if (this.executeOnAdd) callback(this); return this },
			Pick(index) { this.SelectedID = index; this.changed?.(this) } } },
		AddButton(label) { return { label, OnValue(callback) { this.press = () => callback(this); return this } } }
	})
	const root = node("Cooldowns")
	const unit = name => ({
		Tree: node(name), State: { value: true }, PositionX: slider(0), PositionY: slider(0),
		get Position() { return new Vector2(this.PositionX.value * gameScale, this.PositionY.value * gameScale) }
	})
	const style = { Node: node("Style", root), Size: slider(100, 70, 150), FontFamily: "Roboto", FontWeight: 500, Color: { SelectedColor: Color.White }, Effect: { SelectedID: 2 }, EffectColor: { SelectedColor: Color.Black }, EffectOpacity: slider(100, 0, 100) }
	const animation = { value: false }
	const noMana = slider(80, 0, 100)
	const { BaseMenu } = load("src/menu/base")
	const group = name => Object.assign(new BaseMenu({ node: root, nodeName: name, textStyle: style, animation, noMana, defaultSize: 1, texture: name }), {
		Hero: unit("Heroes"), SpiritBear: unit("Bear"), Courier: unit("Courier"), Roshan: unit("Roshan"), Familiar: unit("Familiars"), Pandas: unit("Pandas"), Creep: unit("Creeps")
	})
	const menu = { Node: root, General: node("General", root), Style: style, State: { value: true }, Scale: { value: false }, Opacity: slider(100), OpacityByCursor: { value: false }, Animation: animation, NoMana: noMana, SpellMenu: group("Spells"), ItemMenu: group("Items"), ModifierMenu: group("Modifiers") }
	Object.assign(menu.SpellMenu, { IsMinimalistic: { value: false }, LevelColor: { SelectedColor: Color.Yellow }, ChargeColor: { SelectedColor: Color.Green } })
	Object.assign(menu.ItemMenu, { SquareMode: { SelectedID: 0 }, DimOnCooldown: { value: false } })
	Object.assign(menu.ModifierMenu, { Remaining: { value: true }, ModeImage: { SelectedID: 0 }, ModePosition: { SelectedID: 1 } })
	for (const key of ["Important", "Buffs", "Debuffs", "Auras"]) menu.ModifierMenu[key] = { Tree: node(key), State: { value: true }, TeamState: team() }
	menu.SpellMenu.Hero.PositionY.value = -6
	menu.ItemMenu.Hero.PositionY.value = -32
	menu.ModifierMenu.Hero.PositionY.value = 19
	const { PreviewController } = load("src/preview/controller")
	seed?.({ gameFiles, kv, wearables })
	const preview = new PreviewController(menu)
	Object.assign(preview.Frame, { x: 40, y: 60, w: 300 * gameScale, h: 450 * gameScale })
	const roots = preview.Groups.map(group => { const element = makeElement(); group.Canvas.Ref(element); group.AreaRef(makeElement()); return element })
	preview.AnchorRef(makeElement())
	const silenceRoot = makeElement()
	preview.Silence.Ref(silenceRoot)
	preview.AnchorAreaRef(makeElement())
	const guidesRoot = makeElement()
	preview.Guides.Ref(guidesRoot)
	const tick = visible => preview.Tick(visible, preview.Frame.w, preview.Frame.h)
	const event = data => ({ data, stopPropagation() {} })
	return { preview, menu, sdk, input, roots, guidesRoot, silenceRoot, makeElement, tick, event, load, unitModels, missingArt, gameFiles, kv, timers, context,
		move: (x, y) => move(x, y), release: () => sdk.EndDrag(),
		opened: () => opened, released: () => released,
		page: value => { activePage = value }, time: value => { now = value }
	}
}

test("preview follows its page and descendants without requiring a model or enabled overlay", () => {
	const r = runtime()
	r.page(r.menu.SpellMenu.Tree.entry)
	assert.equal(r.preview.IsShown(), true)
	r.menu.State.value = false
	assert.equal(r.preview.IsShown(), true)
	r.page({ parent: undefined })
	assert.equal(r.preview.IsShown(), false)
})

test("all groups paint, apply shared text settings, reuse their nodes, and hide on close", () => {
	const r = runtime()
	r.tick(true)
	for (const group of r.preview.Groups) assert.ok(group.Canvas.Bounds.w > 0)
	const counts = r.roots.map(root => root.children.length)
	r.tick(true)
	assert.deepEqual(r.roots.map(root => root.children.length), counts)
	r.menu.Style.Effect.SelectedID = 1
	r.menu.Style.EffectOpacity.value = 35
	r.menu.Style.FontFamily = "Open Sans"
	r.tick(true)
	for (const root of r.roots) {
		const text = root.children.find(child => child.text)
		assert.equal(text.style["font-effect"], "shadow(1px 1px #00000059)")
		assert.equal(text.style["font-family"], "Open Sans")
	}
	r.tick(false)
	for (const root of r.roots) assert.ok(root.children.every(child => !child.shown))
	for (const group of r.preview.Groups) assert.equal(group.Area.shown, false)
})

test("colored soft shadows keep glyphs sharp and clear when switching effects", () => {
	const r = runtime()
	r.tick(true)
	const texts = r.roots.map(root => root.children.find(child => child.text))
	const colors = texts.map(text => text.style.color)
	r.menu.Style.EffectColor.SelectedColor = new Color(255, 64, 128)
	r.menu.Style.EffectOpacity.value = 35
	r.menu.Style.Effect.SelectedID = 3
	r.tick(true)
	for (const text of texts) {
		assert.equal(text.style["font-effect"], "none")
		assert.equal(text.style.filter, "drop-shadow(#ff408059 1px 1px 2px)")
	}
	assert.deepEqual(texts.map(text => text.style.color), colors)
	r.menu.Style.Effect.SelectedID = 2
	r.tick(true)
	for (const text of texts) {
		assert.equal(text.style["font-effect"], "outline(1px #ff408059)")
		assert.equal(text.style.filter, "none")
	}
	r.menu.Style.Effect.SelectedID = 3
	r.menu.Style.EffectOpacity.value = 0
	r.tick(true)
	for (const text of texts) assert.equal(text.style.filter, "none")
	r.menu.Style.Effect.SelectedID = 0
	r.menu.Style.EffectOpacity.value = 100
	r.tick(true)
	for (const text of texts) {
		assert.equal(text.style["font-effect"], "none")
		assert.equal(text.style.filter, "none")
	}
})

test("drag translates screen pixels and crosses preview edges within saved offset limits", () => {
	const r = runtime(2, 1.5)
	r.tick(true)
	const group = r.preview.Groups[0]
	const origin = group.Settings.PositionX.value
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	assert.equal(r.sdk.PreviewMotion.value, false)
	// Move away from alignment targets to verify the underlying pixel conversion.
	r.move(135, 205)
	assert.equal(group.Settings.PositionX.value, origin + 47)
	assert.equal(group.Settings.PositionY.value, 114)
	r.move(10000, 10000)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, group.Settings.PositionX.max)
	assert.equal(group.Settings.PositionY.value, group.Settings.PositionY.max)
	assert.ok(group.Canvas.Bounds.x + group.Canvas.Bounds.w > r.preview.Frame.w)
	// The vertical slider range is smaller than this stage; shrink it to check overflow.
	r.preview.Frame.h = 200
	r.tick(true)
	assert.ok(group.Canvas.Bounds.y + group.Canvas.Bounds.h > r.preview.Frame.h)
	r.move(-10000, -10000)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, group.Settings.PositionX.min)
	assert.equal(group.Settings.PositionY.value, group.Settings.PositionY.min)
	assert.ok(group.Canvas.Bounds.x < 0)
	assert.ok(group.Canvas.Bounds.y < 0)
	r.release()
	assert.equal(r.sdk.PreviewMotion.value, true)
})

test("moving the preview card during a drag does not change the saved offset", () => {
	const r = runtime(2)
	r.tick(true)
	const group = r.preview.Groups[0]
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.preview.Frame.x += 40
	r.move(120, 115)
	assert.equal(group.Settings.PositionX.value, 0)
	r.tick(false)
	assert.equal(r.preview.Drag.Active, false)
	assert.equal(r.sdk.PreviewMotion.value, true)
})

test("arrows precisely nudge the held group without snapping or losing the adjustment to the mouse", () => {
	const r = runtime(2, 1.5)
	r.tick(true)
	const group = r.preview.Groups[0]
	const otherX = r.preview.Groups[1].Settings.PositionX.value
	assert.equal(r.input.emit("KeyDown", 39), true)
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.move(115, 130)
	assert.ok(r.preview.Drag.Guides.length > 0)
	const x = group.Settings.PositionX.value
	const y = group.Settings.PositionY.value
	assert.equal(r.input.emit("KeyDown", 65), true)
	assert.equal(r.input.emit("KeyDown", 39), false)
	assert.equal(group.Settings.PositionX.value, x + 1)
	assert.equal(r.preview.Drag.Guides.length, 0)
	r.move(115, 130)
	assert.equal(group.Settings.PositionX.value, x + 1)
	assert.equal(group.Settings.PositionY.value, y)
	r.input.emit("KeyUp", 39)
	r.input.emit("KeyDown", 38)
	assert.equal(group.Settings.PositionY.value, y - 1)
	r.input.emit("KeyUp", 38)
	r.input.emit("KeyDown", 37)
	r.input.emit("KeyUp", 37)
	r.input.emit("KeyDown", 40)
	r.input.emit("KeyUp", 40)
	assert.equal(group.Settings.PositionX.value, x)
	assert.equal(group.Settings.PositionY.value, y)
	r.move(116.5, 130)
	assert.equal(group.Settings.PositionX.value, x + 2)
	assert.equal(r.preview.Groups[1].Settings.PositionX.value, otherX)
	r.release()
	assert.equal(r.input.emit("KeyDown", 39), true)
	assert.equal(group.Settings.PositionX.value, x + 2)
})

test("silence uses localized game artwork at game scale independently of panel styling", () => {
	for (const scale of [1, 1.5, 2]) {
		const r = runtime(2, scale)
		r.sdk.Localization.SelectedUnitName = "russian"
		r.tick(true)
		const root = r.silenceRoot
		const [label, track, fill] = root.children
		assert.equal(root.shown, true)
		assert.match(label.source, /silenced-ru\.png$/)
		assert.equal(label.style.width, Math.round(102.5 * scale))
		assert.equal(label.style.height, Math.round(15 * scale))
		assert.equal(root.style.top, r.preview.Bar.y - Math.round(33 * scale))
		assert.ok(root.style.top + track.style.top + track.style.height < r.preview.Bar.y)
		const before = JSON.stringify(root)
		r.menu.State.value = false
		r.menu.Style.Size.value = 150
		r.menu.SpellMenu.Hero.PositionY.value = -100
		r.time(20)
		r.tick(true)
		assert.equal(JSON.stringify(root), before)
		assert.ok(fill.style.width > 0 && fill.style.width < track.style.width)
		for (const [language, suffix] of [["english", "en"], ["chinese", "cn"], ["unknown", "en"]]) {
			r.sdk.Localization.SelectedUnitName = language
			r.tick(true)
			assert.ok(label.source.endsWith(`silenced-${suffix}.png`))
		}
		assert.equal(root.children.length, 3)
	}
})

test("silence toggle and preview visibility hide the reference without moving the health bar", () => {
	const r = runtime()
	const { PreviewStage } = r.load("src/preview/view")
	const stage = PreviewStage({ preview: r.preview })
	const reference = stage.children.find(child => child.props.ref === r.preview.Silence.Ref)
	assert.equal(reference.props.style.pointerEvents, "none")
	assert.equal(reference.props.onMouseDown, undefined)
	assert.ok(stage.children.indexOf(reference) < stage.children.findIndex(child => child.props.ref === r.preview.Groups[0].Canvas.Ref))
	for (const unit of [0, 1, 6, 0]) {
		r.preview.Unit.SelectedID = unit
		r.tick(true)
		assert.equal(r.silenceRoot.shown, true)
	}
	const bar = r.preview.Bar.Clone()
	r.preview.ShowSilence.value = false
	r.tick(true)
	assert.equal(r.silenceRoot.shown, false)
	assert.deepEqual(r.preview.Bar, bar)
	r.preview.ShowSilence.value = true
	r.tick(true)
	assert.equal(r.silenceRoot.shown, true)
	r.tick(false)
	assert.equal(r.silenceRoot.shown, false)
	const released = r.released()
	r.preview.Silence.Ref(null)
	assert.equal(r.released(), released + 1)
	r.tick(true)
})

test("held arrows repeat after a delay, clamp, and reset on release or cancellation", () => {
	const r = runtime()
	r.tick(true)
	const group = r.preview.Groups[0]
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.input.emit("KeyDown", 39)
	r.input.emit("KeyDown", 39)
	assert.equal(group.Settings.PositionX.value, 1)
	r.time(1.39)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, 1)
	r.time(1.4)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, 2)
	r.time(1.45)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, 3)
	r.input.emit("KeyUp", 39)
	r.time(2)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, 3)
	r.move(10000, 10000)
	r.input.emit("KeyDown", 39)
	r.input.emit("KeyDown", 40)
	assert.equal(group.Settings.PositionX.value, group.Settings.PositionX.max)
	assert.equal(group.Settings.PositionY.value, group.Settings.PositionY.max)
	r.move(-10000, -10000)
	r.input.emit("KeyDown", 37)
	r.input.emit("KeyDown", 38)
	assert.equal(group.Settings.PositionX.value, group.Settings.PositionX.min)
	assert.equal(group.Settings.PositionY.value, group.Settings.PositionY.min)
	r.tick(false)
	assert.equal(r.input.emit("KeyDown", 39), true)
	assert.equal(r.sdk.PreviewMotion.value, true)
	r.tick(true)
	const x = group.Settings.PositionX.value
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.time(5)
	r.tick(true)
	assert.equal(group.Settings.PositionX.value, x)
	r.input.emit("KeyDown", 39)
	assert.equal(group.Settings.PositionX.value, x + 1)
	r.preview.Unit.SelectedID = 1
	r.preview.Unit.changed()
	assert.equal(r.input.emit("KeyDown", 39), true)
	assert.equal(r.preview.Drag.Active, false)
})

test("wheel resizes the selected group, Ctrl-wheel adjusts text, and both clamp", () => {
	const r = runtime()
	const group = r.preview.Groups[0]
	r.preview.Drag.Resize(group, r.event({ wheel_delta_y: -1 }))
	assert.equal(group.Menu.Size.value, 2)
	r.preview.Drag.Resize(group, r.event({ wheel_delta_y: -1, ctrlKey: true }))
	assert.equal(r.menu.Style.Size.value, 105)
	group.Menu.Size.value = group.Menu.Size.max
	r.preview.Drag.Resize(group, r.event({ wheel_delta_y: -1 }))
	assert.equal(group.Menu.Size.value, group.Menu.Size.max)
	r.menu.Style.Size.value = 70
	r.preview.Drag.Resize(group, r.event({ wheel_delta_y: 1, ctrlKey: true }))
	assert.equal(r.menu.Style.Size.value, 70)
})

test("minimum-size item charges stay readable below 100 percent text size", () => {
	for (const scale of [1, 1.5]) {
		const r = runtime(1, scale)
		r.menu.ItemMenu.Size.value = 0
		r.tick(true)
		const charge = () => r.roots[1].children.find(child => child.shown && child.text === "12" && child.style["text-align"] === "right")
		const original = charge().style["font-size"]
		const cooldown = r.roots[1].children.find(child => child.shown && child.text && child.text !== "12")
		const cooldownSize = cooldown.style["font-size"]
		for (const percent of [95, 80, 70]) {
			r.menu.Style.Size.value = percent
			r.tick(true)
			assert.equal(charge().style["font-size"], original)
		}
		assert.ok(cooldown.style["font-size"] < cooldownSize)
		r.menu.Style.Size.value = 150
		r.tick(true)
		assert.ok(charge().style["font-size"] > original)
	}
})

test("element text overrides render independently, preserve settings, and resize the active style", () => {
	const r = runtime()
	for (let index = 0; index < r.preview.Groups.length; index++) {
		const group = r.preview.Groups[index]
		const own = group.Menu.Style
		assert.equal(own.Node.Name, "Text settings")
		assert.equal(own.Size.min, 70)
		assert.equal(group.Menu.TextStyle, r.menu.Style)
		assert.equal(own.Size.IsHidden, true)
		own.Override.value = true
		own.Override.changed()
		own.Font.SelectedID = 1
		own.Size.value = 70
		own.Weight.SelectedID = 3
		own.Color.SelectedColor = new Color(255, 64, 128)
		own.Effect.SelectedID = 0
		own.Effect.changed()
		assert.equal(own.Size.IsHidden, false)
		assert.equal(own.EffectColor.IsHidden, true)
		r.tick(true)
		const text = r.roots[index].children.find(child => child.shown && child.text && child.style.color === "#ff4080ff")
		assert.equal(text.style["font-family"], "Open Sans")
		assert.equal(text.style["font-weight"], "700")
		assert.equal(text.style["font-effect"], "none")
		assert.equal(text.style.color, "#ff4080ff")
		for (const other of r.preview.Groups.filter(other => other !== group)) {
			assert.equal(other.Menu.TextStyle, r.menu.Style)
		}
		r.preview.Drag.Resize(group, r.event({ wheel_delta_y: 1, ctrlKey: true }))
		assert.equal(own.Size.value, 70)
		r.preview.Drag.Resize(group, r.event({ wheel_delta_y: -1, ctrlKey: true }))
		assert.equal(own.Size.value, 75)
		assert.equal(r.menu.Style.Size.value, 100)
		own.Override.value = false
		own.Override.changed()
		r.tick(true)
		assert.equal(text.style["font-family"], "Roboto")
		assert.equal(own.Size.IsHidden, true)
		own.Override.value = true
		own.Override.changed()
		assert.equal(group.Menu.TextStyle.Size.value, 75)
		own.Override.value = false
		own.Override.changed()
	}
})

test("unit and team changes edit the right settings and preserve other teams", () => {
	const r = runtime()
	const group = r.preview.Groups[0]
	r.preview.Unit.SelectedID = 1
	r.preview.Unit.changed()
	assert.equal(group.Settings, r.menu.SpellMenu.SpiritBear)
	r.preview.Team.SelectedID = 1
	r.preview.Toggle(group)
	assert.equal(group.Menu.TeamState.IsSelected(0), true)
	assert.equal(group.Menu.TeamState.IsSelected(1), true)
	r.preview.Toggle(group)
	assert.equal(group.Menu.TeamState.IsSelected(0), true)
	assert.equal(group.Menu.TeamState.IsSelected(1), false)
	r.preview.Unit.SelectedID = 6
	assert.equal(r.preview.Groups[1].Settings, undefined)
	assert.equal(r.preview.Groups[2].Settings, undefined)
})

test("modifier popup opens the element's own card and filters samples live", () => {
	const r = runtime()
	const group = r.preview.Groups[2]
	r.preview.Drag.Configure(group)
	assert.equal(r.opened().node, r.menu.ModifierMenu.Tree)
	assert.equal(r.opened().sections, undefined)
	r.tick(true)
	const width = group.Canvas.Bounds.w
	r.menu.ModifierMenu.Buffs.State.value = false
	r.menu.ModifierMenu.Auras.State.value = false
	r.tick(true)
	assert.ok(group.Canvas.Bounds.w < width)
})

test("changing the preview unit keeps its configuration panel open", () => {
	const r = runtime()
	r.preview.Open(r.preview.Node)
	r.preview.Unit.SelectedID = 1
	r.preview.Unit.changed()
	assert.equal(r.opened().node, r.preview.Node)
})

test("unmount releases sample artwork and remount creates fresh nodes", () => {
	const r = runtime()
	r.tick(true)
	const group = r.preview.Groups[0]
	group.Canvas.Ref(null)
	assert.equal(r.released(), 4)
	const root = r.makeElement()
	group.Canvas.Ref(root)
	r.tick(true)
	assert.ok(root.children.some(child => child.shown))
})

test("hero preview renders six distinct items and keeps all six when changing shape", () => {
	const r = runtime()
	const sources = () => r.roots[1].children.filter(child => child.shown).flatMap(child => child.children.map(art => art.source).filter(Boolean))
	r.tick(true)
	assert.equal(sources().length, 6)
	assert.equal(new Set(sources()).size, 6)
	// The samples are drawn from the package's own art, not the game's textures.
	assert.ok(sources().every(source => source.startsWith("cooldowns/scripts_files/cooldowns/preview/art/")))
	r.menu.ItemMenu.SquareMode.SelectedID = 1
	r.tick(true)
	assert.equal(sources().length, 6)
})

// A Source 2 resource with a DATA header and the full mip after the resource blocks.
function iconTexture(format, pixels, width = 4, height = 4) {
	const bytes = Buffer.alloc(68 + pixels.length)
	bytes.writeUInt32LE(68, 0)
	bytes.writeUInt32LE(8, 8)
	bytes.writeUInt32LE(1, 12)
	bytes.write("DATA", 16)
	bytes.writeUInt32LE(8, 20)
	bytes.writeUInt32LE(40, 24)
	bytes.writeUInt16LE(width, 48)
	bytes.writeUInt16LE(height, 50)
	bytes[54] = format
	bytes[55] = 1
	pixels.copy(bytes, 68)
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function previewImages(r) {
	const minted = [], freed = [], reads = []
	const files = new Map()
	// a file handed to the host is one the game ships, as far as the loader can tell
	const bundled = r.context.fexists
	r.context.fexists = source => files.has(source) || bundled(source)
	r.context.fread = source => {
		reads.push(source)
		return files.get(source)
	}
	r.context.RegisterImageBlob = bytes => {
		minted.push(Buffer.from(bytes))
		return `octarine://preview/${minted.length}`
	}
	r.context.FreeImageBlob = source => freed.push(source)
	return { files, minted, freed, reads, art: r.load("src/preview/art") }
}

test("every bundled preview PNG decodes with its original colours and alpha", () => {
	const r = runtime()
	const { DecodePngGray } = r.load("src/gui/png")
	const directory = path.join(__dirname, "../scripts_files/cooldowns/preview/art")
	for (const name of fs.readdirSync(directory)) {
		if (!name.endsWith(".png")) continue
		const bytes = fs.readFileSync(path.join(directory, name))
		const image = DecodePngGray(bytes, 0, bytes.length, true)
		assert.ok(image?.rgba, name)
		assert.equal(image.width, bytes.readUInt32BE(16), name)
		assert.equal(image.height, bytes.readUInt32BE(20), name)
		assert.ok(image.rgba.some((channel, index) => index % 4 === 3 && channel > 0), name)
		const colours = new Set(Array.from({ length: image.width * image.height }, (_, pixel) =>
			image.rgba.slice(pixel * 4, pixel * 4 + 3).join(",")))
		assert.ok(colours.size > 1, `${name} must not be a flat tile`)
	}
})

test("full-colour texture decoding preserves DXT colours and alpha without changing gray-only decoding", () => {
	const r = runtime()
	const { DecodeTexture, EncodeRgbaPng } = r.load("src/gui/gray")
	const pixels = Buffer.alloc(16)
	pixels[0] = 127
	pixels.writeUInt16LE(0xf800, 8) // All texels select the first, red endpoint.
	const texture = iconTexture(2, pixels)
	const image = DecodeTexture(texture, true)
	assert.deepEqual([...image.rgba.slice(0, 4)], [255, 0, 0, 127])
	assert.ok(image.luma.every(value => value === 54))
	assert.equal(DecodeTexture(texture).rgba, undefined)
	const png = Buffer.from(EncodeRgbaPng(image.width, image.height, image.rgba))
	const length = png.readUInt32BE(33)
	const raw = require("node:zlib").inflateSync(png.subarray(41, 41 + length))
	assert.deepEqual([...raw.subarray(1, 5)], [255, 0, 0, 127])
	assert.equal(raw.length, (1 + 4 * 4) * 4)
})

test("preview decodes unbundled hero art from the full mip and respects texture aliases", () => {
	const r = runtime()
	const io = previewImages(r)
	r.context.AbilityData.GetAbilityByName = name => name === "hero_spell"
		? { TexturePath: "spells/renamed_spell_png.vtex_c" } : undefined
	const pixels = Buffer.alloc(64)
	for (let at = 0; at < pixels.length; at += 4) pixels.set([25, 80, 190, 255], at)
	io.files.set("spells/renamed_spell_png.vtex_c", iconTexture(4, pixels))
	assert.equal(io.art.PreviewArt("hero_spell"), "octarine://preview/1")
	assert.equal(io.art.PreviewTexture("hero_spell"), "spells/renamed_spell_png.vtex_c")
	const { DecodePngGray } = r.load("src/gui/png")
	const png = io.minted[0]
	assert.deepEqual([...DecodePngGray(png, 0, png.length, true).rgba.slice(0, 4)], [25, 80, 190, 255])
	const reads = io.reads.length
	assert.equal(io.art.PreviewArt("hero_spell"), "octarine://preview/1")
	assert.equal(io.reads.length, reads)
})

test("new PNG-backed hero textures are decoded without depending on a bundled ability file", () => {
	const r = runtime()
	const io = previewImages(r)
	const png = fs.readFileSync(path.join(__dirname, "../scripts_files/cooldowns/preview/art/void_spirit_aether_remnant.png"))
	const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
	io.files.set("spells/largo_catchy_lick_png.vtex_c", iconTexture(16, png, width, height))
	assert.equal(io.art.PreviewArt("largo_catchy_lick"), "octarine://preview/1")
	const { DecodePngGray } = r.load("src/gui/png")
	const original = DecodePngGray(png, 0, png.length, true)
	assert.deepEqual([...DecodePngGray(io.minted[0], 0, io.minted[0].length, true).rgba], [...original.rgba])
})

test("item art waits for decoding, then replaces the placeholder without another read or registration", () => {
	const r = runtime()
	const io = previewImages(r)
	const png = fs.readFileSync(path.join(__dirname, "../scripts_files/cooldowns/preview/art/blink.png"))
	io.files.set("cooldowns/scripts_files/cooldowns/preview/art/blink.png", png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength))
	r.sdk.HostImageReady = () => false
	assert.match(io.art.PreviewArt("item_blink"), /\/missing\.png$/)
	assert.match(io.art.PreviewArt("item_blink"), /\/missing\.png$/)
	assert.equal(io.reads.length, 1)
	r.sdk.HostImageReady = () => true
	assert.equal(io.art.PreviewArt("item_blink"), "octarine://preview/1")
	assert.equal(io.minted.length, 1)
	assert.equal(io.freed.length, 0)
})

test("missing or damaged art retries later and cannot poison the icon cache", () => {
	const r = runtime()
	const io = previewImages(r)
	io.files.set("cooldowns/scripts_files/cooldowns/preview/art/blink.png", new ArrayBuffer(12))
	assert.match(io.art.PreviewArt("item_blink"), /\/missing\.png$/)
	const reads = io.reads.length
	assert.match(io.art.PreviewArt("item_blink"), /\/missing\.png$/)
	assert.equal(io.reads.length, reads)
	io.files.set("items/blink_png.vtex_c", iconTexture(4, Buffer.alloc(64, 255)))
	r.time(7)
	assert.equal(io.art.PreviewArt("item_blink"), "octarine://preview/1")
})

test("empty metadata and transparent textures cannot become permanent blank icons", () => {
	const r = runtime()
	const io = previewImages(r)
	r.context.AbilityData.GetAbilityByName = () => ({ TexturePath: "spells/empty_png.vtex_c" })
	assert.equal(io.art.PreviewTexture("new_spell"), "spells/new_spell_png.vtex_c")
	io.files.set("spells/new_spell_png.vtex_c", iconTexture(4, Buffer.alloc(64)))
	assert.match(io.art.PreviewArt("new_spell"), /\/missing\.png$/)
	assert.equal(io.minted.length, 0)
	io.files.set("spells/new_spell_png.vtex_c", iconTexture(4, Buffer.alloc(64, 255)))
	r.time(7)
	assert.equal(io.art.PreviewArt("new_spell"), "octarine://preview/1")
})

test("a spell the game ships no art for stands as its empty icon, and the files are asked once", () => {
	const r = runtime()
	// an ability whose icon is not the file its name spells: only the game's data knows, and it
	// is asked through that data rather than through an ability on the field, of which the card
	// has none
	r.context.AbilityData.GetAbilityByName = name => name === "largo_frogstomp"
		? { TexturePath: "spells/largo_stomp_png.vtex_c" } : undefined
	// and one the game ships no art for at all, which stands as its empty icon rather than as a
	// path to nothing, drawn as a white box
	r.missingArt.add("spells/largo_encore_png.vtex_c")
	const asked = []
	const shipped = r.context.fexists
	r.context.fexists = source => {
		asked.push(source)
		return shipped(source)
	}
	r.tick(true)
	const art = r.roots[0].children
		.flatMap(child => child.children.map(piece => piece.source))
		.filter(source => typeof source === "string" && source.startsWith("spells/"))
	assert.deepEqual(art, [
		"spells/largo_catchy_lick_png.vtex_c",
		"spells/largo_stomp_png.vtex_c",
		"spells/largo_croak_of_genius_png.vtex_c",
		"spells/empty_png.vtex_c"
	])
	// an asset does not come and go while the game runs: each file is asked about once
	const once = asked.length
	r.tick(true)
	r.tick(true)
	assert.equal(asked.length, once)
})

test("a stuck generated image is released and retried, and switching heroes bounds the cache", () => {
	const r = runtime()
	const io = previewImages(r)
	const texture = iconTexture(4, Buffer.alloc(64, 255))
	r.context.fread = source => source.endsWith(".vtex_c") ? texture : undefined
	r.sdk.HostImageReady = () => false
	assert.match(io.art.PreviewArt("first"), /\/missing\.png$/)
	r.time(7)
	r.sdk.HostImageReady = source => source !== "octarine://preview/1"
	assert.equal(io.art.PreviewArt("first"), "octarine://preview/2")
	assert.deepEqual(io.freed, ["octarine://preview/1"])
	for (let index = 0; index < 140; index++) io.art.PreviewArt(`hero_${index}`)
	assert.equal(io.minted.length - io.freed.length, 128)
})

test("gray art is not put on an image element before the host has decoded it", () => {
	const r = runtime()
	const { HudCanvas } = r.load("src/gui/canvas")
	r.load("src/gui/gray").WashCopy = () => "octarine://pending-wash"
	const canvas = new HudCanvas()
	const root = r.makeElement()
	canvas.Ref(root)
	root.ownerDocument.createElement = tag => ({ tagName: tag, ownerDocument: root.ownerDocument, style: {}, children: [],
		appendChild(child) { this.children.push(child) }, setAttribute(name, value) { this[name] = value } })
	const draw = () => {
		canvas.Begin()
		canvas.Image("original.png", new Vector2(), new Vector2(20, 20), { wash: { mid: Color.White, top: Color.White } })
		canvas.End()
	}
	r.sdk.HostImageReady = () => false
	draw()
	const [art, gray] = root.children[0].children
	assert.equal(art.shown, true)
	assert.equal(gray.shown, false)
	assert.equal(gray.src, undefined)
	r.sdk.HostImageReady = () => true
	draw()
	assert.equal(art.shown, false)
	assert.equal(gray.shown, true)
	assert.equal(gray.src, "octarine://pending-wash")
})

test("hosts without image blobs keep the geometry clip without a composited shader mask", () => {
	const r = runtime(2)
	const { HudCanvas } = r.load("src/gui/canvas")
	const canvas = new HudCanvas()
	const root = r.makeElement()
	canvas.Ref(root)
	r.sdk.ImageSize = () => new Vector2(88, 64)
	const draw = (position, size, style) => {
		canvas.Begin()
		canvas.Image("blink.png", position, size, style)
		canvas.End()
	}
	draw(new Vector2(12, 20), new Vector2(44, 32), { radius: 12 })
	const box = root.children[0], art = box.children[0]
	assert.equal(box.style["mask-image"], "none")
	assert.equal(box.style["border-radius"], 12)
	assert.equal(box.style.overflow, "hidden")
	assert.equal(box.style.clip, "always")
	assert.equal(art.source, "blink.png")
	assert.equal(art.shown, true)
	// Switching shape and moving the same slot keeps the image and crops its centre.
	draw(new Vector2(25, 34), new Vector2(32, 32), { circle: true })
	assert.equal(root.children[0], box)
	assert.equal(box.style["mask-image"], "none")
	assert.equal(box.style["border-radius"], 16)
	assert.equal(art.style.left, -6)
	assert.equal(art.style.width, 44)
	assert.equal(art.shown, true)
	draw(new Vector2(25, 34), new Vector2(44, 32), { radius: 0 })
	assert.equal(box.style["border-radius"], 0)
	assert.equal(art.style.left, 0)
	assert.equal(art.source, "blink.png")
})

test("rounded alpha is smooth and symmetric at icon sizes while square pixels stay unchanged", () => {
	const r = runtime()
	const { RoundedPixels } = r.load("src/gui/rounded")
	for (const [width, height, radius] of [[20, 20, 10], [44, 32, 15.5], [17, 17, 4.25]]) {
		const rgba = new Uint8Array(width * height * 4).fill(255)
		const image = { width, height, rgba }
		const rounded = RoundedPixels(image, width, height, radius)
		const alpha = (x, y) => rounded[(y * width + x) * 4 + 3]
		assert.equal(alpha(0, 0), 0)
		assert.equal(alpha(Math.floor(width / 2), Math.floor(height / 2)), 255)
		assert.ok(rounded.some((value, index) => index % 4 === 3 && value > 0 && value < 255))
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			assert.equal(alpha(x, y), alpha(width - 1 - x, y))
			assert.equal(alpha(x, y), alpha(x, height - 1 - y))
		}
		assert.deepEqual([...RoundedPixels(image, width, height, 0)], [...rgba])
	}
})

test("rounded copies centre-crop items and filter transparency without dark or coloured fringes", () => {
	const r = runtime()
	const { RoundedPixels } = r.load("src/gui/rounded")
	const rgba = new Uint8Array(8 * 4 * 4)
	for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) rgba.set([x * 30, 60, 90, 255], (y * 8 + x) * 4)
	const cropped = RoundedPixels({ width: 8, height: 4, rgba }, 4, 4, 0)
	assert.deepEqual([cropped[0], cropped[4], cropped[8], cropped[12]], [60, 90, 120, 150])
	const transparent = { width: 2, height: 1, rgba: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 0]) }
	// Same aspect ratio so the whole source participates in one output pixel's area.
	const wide = { width: 2, height: 2, rgba: new Uint8Array([...transparent.rgba, ...transparent.rgba]) }
	assert.deepEqual([...RoundedPixels(wide, 1, 1, 0)], [255, 0, 0, 128])
})

test("preview renders ready antialiased pixels without cutting them again, including the mana wash", () => {
	const r = runtime()
	const io = previewImages(r)
	const png = fs.readFileSync(path.join(__dirname, "../scripts_files/cooldowns/preview/art/blink.png"))
	io.files.set("cooldowns/scripts_files/cooldowns/preview/art/blink.png", png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength))
	const original = io.art.PreviewArt("item_blink")
	const { HudCanvas } = r.load("src/gui/canvas")
	const { DecodePngGray } = r.load("src/gui/png")
	const canvas = new HudCanvas(), root = r.makeElement()
	canvas.Ref(root)
	const draw = wash => {
		canvas.Begin()
		canvas.Image(original, new Vector2(50, 80), new Vector2(32, 32), { radius: 12, wash })
		canvas.End()
	}
	r.sdk.HostImageReady = source => source === original
	draw()
	const box = root.children[0], art = box.children[0]
	assert.equal(art.source, original)
	assert.equal(art.shown, true)
	r.sdk.HostImageReady = () => true
	draw()
	assert.equal(io.minted.length, 2)
	assert.equal(art.source, "octarine://preview/2")
	assert.equal(box.style["mask-image"], "none")
	assert.equal(box.style["border-radius"], 0)
	assert.equal(art.style.left, 0)
	assert.equal(art.style.width, 32)
	const decoded = DecodePngGray(io.minted[1], 0, io.minted[1].length, true)
	assert.ok(decoded.alpha.some(a => a > 0 && a < 255))
	const wash = { mid: new Color(96, 149, 253), top: new Color(200, 222, 255) }
	draw(wash)
	assert.equal(art.source, "octarine://preview/3")
	assert.equal(box.style["border-radius"], 0)
	assert.equal(art.style["image-color"], "rgba(255,255,255,255)")
	const washed = DecodePngGray(io.minted[2], 0, io.minted[2].length, true)
	assert.deepEqual([...washed.alpha], [...decoded.alpha])
	assert.notDeepEqual([...washed.rgba], [...decoded.rgba])
	for (let frame = 0; frame < 60; frame++) draw(wash)
	assert.equal(io.minted.length, 3)
	assert.equal(io.reads.length, 1)
})

test("rounded copies retry failed uploads, follow size and radius changes, and release with the original", () => {
	const r = runtime()
	const io = previewImages(r)
	const rounded = r.load("src/gui/rounded")
	const path = "octarine://original"
	rounded.RememberArtPixels(path, { width: 4, height: 4, rgba: new Uint8Array(64).fill(255) })
	const register = r.context.RegisterImageBlob
	r.context.RegisterImageBlob = () => ""
	assert.equal(rounded.RoundedArt(path, 20, 20, 10), undefined)
	r.context.RegisterImageBlob = register
	rounded.OpenRoundedFrame()
	assert.equal(rounded.RoundedArt(path, 20, 20, 10), undefined)
	r.time(7)
	assert.equal(rounded.RoundedArt(path, 20, 20, 10), "octarine://preview/1")
	assert.equal(rounded.RoundedArt(path, 20, 20, 10), "octarine://preview/1")
	assert.equal(rounded.RoundedArt(path, 20, 20, 5), "octarine://preview/2")
	// Work on another size is deferred to the next frame, retaining the visible original.
	assert.equal(rounded.RoundedArt(path, 32, 32, 5), undefined)
	rounded.OpenRoundedFrame()
	assert.equal(rounded.RoundedArt(path, 32, 32, 5), "octarine://preview/3")
	rounded.ForgetArtPixels(path)
	assert.deepEqual(io.freed, ["octarine://preview/1", "octarine://preview/2", "octarine://preview/3"])
})

test("preview redraws keep loaded item and spell images outside the mask compositor", () => {
	const r = runtime()
	r.menu.Animation.value = true
	r.menu.ItemMenu.Rounding.value = r.menu.SpellMenu.Rounding.value = 10
	r.menu.ItemMenu.DimOnCooldown.value = true
	let checked = 0
	// Cross cooldown changes, item removal/reentry, movement and the square-item toggle.
	for (let frame = 0; frame < 480; frame++) {
		r.time(1 + frame / 30)
		r.menu.ItemMenu.SquareMode.SelectedID = frame < 240 ? 0 : 1
		r.tick(true)
		for (const root of r.roots.slice(0, 2)) {
			for (const box of root.children.filter(child => child.shown && child.children.some(art => art.source))) {
				assert.equal(box.style["mask-image"], "none")
				assert.ok(box.style["border-radius"] > 0)
				assert.ok(box.children.some(art => art.shown && art.source))
				checked++
			}
		}
	}
	assert.ok(checked > 4000)
})

test("snapping finds stage centres, peer centres and edges, with a DPI-scaled threshold", () => {
	const r = runtime(2)
	const { SnapPreview } = r.load("src/preview/snap")
	const stage = { x: 40, y: 60, w: 500, h: 500 }
	const limits = { minX: 0, maxX: 450, minY: 0, maxY: 460 }
	const snap = (bounds, peers = []) => SnapPreview(bounds, stage, peers, limits)
	const centered = snap({ x: 218, y: 237, w: 50, h: 40 })
	assert.equal(centered.x, 225)
	assert.equal(centered.y, 230)
	assert.ok(centered.guides.some(line => line.x1 === 250 && line.x2 === 250))
	assert.equal(snap({ x: 210, y: 150, w: 50, h: 40 }).x, 210)
	const peer = { x: 80, y: 360, w: 90, h: 30 }
	assert.equal(snap({ x: 102, y: 150, w: 50, h: 40 }, [peer]).x, 100)
	assert.equal(snap({ x: 82, y: 150, w: 50, h: 40 }, [peer]).x, 80)
	assert.equal(snap({ x: 172, y: 150, w: 50, h: 40 }, [peer]).x, 170)
})

test("equal spacing snaps between neighbours and repeats the gap on either side", () => {
	const r = runtime()
	const { SnapPreview } = r.load("src/preview/snap")
	const stage = { x: 0, y: 0, w: 600, h: 600 }
	const limits = { minX: 0, maxX: 560, minY: 0, maxY: 560 }
	const peers = [{ x: 100, y: 80, w: 40, h: 40 }, { x: 240, y: 80, w: 40, h: 40 }]
	const middle = SnapPreview({ x: 173, y: 80, w: 40, h: 40 }, stage, peers, limits)
	assert.equal(middle.x, 170)
	const gaps = middle.guides.filter(line => line.spacing)
	assert.equal(gaps.length, 2)
	assert.deepEqual(Array.from(gaps, line => line.x2 - line.x1), [30, 30])
	const tight = [{ x: 120, y: 80, w: 40, h: 40 }, { x: 190, y: 80, w: 40, h: 40 }]
	assert.equal(SnapPreview({ x: 52, y: 80, w: 40, h: 40 }, stage, tight, limits).x, 50)
	assert.equal(SnapPreview({ x: 262, y: 80, w: 40, h: 40 }, stage, tight, limits).x, 260)
	const vertical = peers.map(peer => ({ x: peer.y, y: peer.x, w: peer.h, h: peer.w }))
	assert.equal(SnapPreview({ x: 80, y: 173, w: 40, h: 40 }, stage, vertical, limits).y, 170)
})

test("snapping ignores hidden groups, unrelated gaps and targets beyond movement limits", () => {
	const r = runtime()
	const { SnapPreview } = r.load("src/preview/snap")
	const stage = { x: 0, y: 0, w: 600, h: 600 }
	const bounds = { x: 173, y: 80, w: 40, h: 40 }
	const limits = { minX: 172, maxX: 560, minY: 0, maxY: 560 }
	const peers = [{ x: 100, y: 80, w: 40, h: 40 }, { x: 240, y: 80, w: 40, h: 40 }]
	assert.equal(SnapPreview(bounds, stage, peers, limits).x, 173)
	assert.equal(SnapPreview(bounds, stage, peers.map(peer => ({ ...peer, y: 200 })), { ...limits, minX: 0 }).x, 173)
	assert.equal(SnapPreview(bounds, stage, [{ x: 175, y: 80, w: 0, h: 0 }], limits).x, 173)
})

test("dragging snaps a row to the HP bar and releases the guides and outline", () => {
	const r = runtime(2, 1.5)
	r.tick(true)
	const group = r.preview.Groups[0]
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.move(115, 130)
	r.tick(true)
	assert.ok(Math.abs(group.Canvas.Bounds.y + group.Canvas.Bounds.h - r.preview.Bar.pos2.y) <= 1)
	assert.equal(group.Dragging, true)
	assert.ok(r.guidesRoot.children.some(line => line.shown))
	const count = r.guidesRoot.children.length
	r.tick(true)
	assert.equal(r.guidesRoot.children.length, count)
	r.move(135, 205)
	r.tick(true)
	assert.equal(r.preview.Drag.Guides.length, 0)
	assert.ok(r.guidesRoot.children.every(line => !line.shown))
	r.release()
	r.tick(true)
	assert.equal(group.Dragging, false)
	assert.equal(r.sdk.PreviewMotion.value, true)
})

test("HP bar stays fixed while groups move and only offers preview settings", () => {
	const r = runtime(2, 1.5)
	r.tick(true)
	const bar = r.preview.Bar.Clone()
	const { PreviewStage } = r.load("src/preview/view")
	const stage = PreviewStage({ preview: r.preview })
	const area = stage.children.find(child => child.props.ref === r.preview.AnchorAreaRef)
	assert.equal(area.props.onMouseDown, undefined)
	area.props.onMouseUp(r.event({ button: 0 }))
	assert.equal(r.preview.Drag.Active, false)
	assert.equal(r.opened(), undefined)
	area.props.onMouseUp(r.event({ button: 1 }))
	assert.equal(r.opened().node, r.preview.Node)
	const group = r.preview.Groups[0]
	r.preview.Drag.Begin(group, r.event({ button: 0, screenX: 200, screenY: 230 }))
	r.move(10000, 10000)
	r.tick(true)
	assert.deepEqual(r.preview.Bar, bar)
	r.release()
})

test("unmounting the HP bar cancels the active group drag and clears guides", () => {
	const r = runtime()
	r.tick(true)
	r.preview.Drag.Begin(r.preview.Groups[0], r.event({ button: 0, screenX: 100, screenY: 100 }))
	r.move(130, 130)
	assert.equal(r.preview.Drag.Active, true)
	r.preview.AnchorRef(null)
	assert.equal(r.preview.Drag.Active, false)
	assert.equal(r.preview.Drag.Guides.length, 0)
	assert.equal(r.sdk.PreviewMotion.value, true)
})

test("derived paint is built once per element and rebuilt when its own inputs change", () => {
	const r = runtime()
	r.tick(true)
	let shapes = 0
	let measured = 0
	const sdf = r.sdk.SdfShape
	const imageSize = r.sdk.ImageSize
	r.sdk.SdfShape = (...values) => { shapes++; return sdf(...values) }
	r.sdk.ImageSize = path => { measured++; return imageSize(path) }
	const root = r.roots[1]
	const decorators = root.children.map(child => child.style.decorator)
	const sources = root.children.map(child => child.children.map(art => art.source))
	r.tick(true)
	// An unchanged frame reuses every shader fragment and asks the host for no size again.
	assert.equal(shapes, 0)
	assert.equal(measured, 0)
	assert.deepEqual(root.children.map(child => child.style.decorator), decorators)
	assert.deepEqual(root.children.map(child => child.children.map(art => art.source)), sources)
	r.menu.Opacity.value = 60
	r.tick(true)
	assert.ok(shapes > 0)
	assert.notDeepEqual(root.children.map(child => child.style.decorator), decorators)
	const faded = root.children.map(child => child.style.decorator)
	shapes = 0
	r.tick(true)
	assert.equal(shapes, 0)
	assert.deepEqual(root.children.map(child => child.style.decorator), faded)
	r.menu.ItemMenu.Rounding.value = 6
	r.tick(true)
	assert.ok(shapes > 0)
	assert.notDeepEqual(root.children.map(child => child.style.decorator), faded)
})

test("the stage stands the unit the picker names, and the creep of the side it is dressed for", () => {
	const r = runtime()
	const paths = [
		// the hero row stands whichever hero the card is dressed for, not a unit of its own
		"models/heroes/bard/bard_frog_base.vmdl",
		"models/heroes/lone_druid/spirit_bear.vmdl",
		"models/props_gameplay/donkey.vmdl",
		"models/creeps/roshan/roshan.vmdl",
		"models/heroes/visage/visage_familiar.vmdl",
		"models/heroes/brewmaster/brewmaster_earthspirit.vmdl",
		"models/creeps/lane_creeps/creep_bad_melee/creep_bad_melee.vmdl"
	]
	// Every row of the picker stands something, in the dashboard where no unit data is loaded.
	assert.equal(r.preview.Unit.values.length, paths.length)
	for (let unit = 0; unit < paths.length; unit++) {
		r.preview.Unit.SelectedID = unit
		assert.equal(r.preview.Model(), paths[unit])
	}
	// The lane creep is the one subject whose look is the side it fights for.
	const creep = paths.length - 1
	for (const [team, model] of [[1, "radiant_melee"], [2, "radiant_melee"], [0, "creep_bad_melee"]]) {
		r.preview.Team.SelectedID = team
		assert.ok(r.preview.Model().includes(model))
	}
	// A model the game renamed is followed, once the data behind the name is there to say so.
	r.preview.Unit.SelectedID = 2
	r.preview.Team.SelectedID = 0
	r.unitModels.set("npc_dota_courier", "models/props_gameplay/donkey_v2.vmdl")
	assert.equal(r.preview.Model(), "models/props_gameplay/donkey_v2.vmdl")
})

test("the hero picker offers the game's own roster and dresses the one it is set to", () => {
	// the roster is read as the menu is built, so the files are there before it: the option that
	// was picked last time has to be in the list for the setting to come back to it
	const r = runtime(1, 1, ({ gameFiles, kv, wearables }) => {
		// npc_heroes.txt is a list of #base includes; the host follows them, so one read is the roster
		gameFiles.set(
			"scripts/npc/npc_heroes.txt",
			kv({
				DOTAHeroes: kv({
					// the block every hero inherits from, which is not a hero
					npc_dota_hero_base: kv({ Model: "models/heroes/base.vmdl" }),
					npc_dota_hero_axe: kv({
						Model: "models/heroes/axe/axe.vmdl",
						Enabled: "1",
						workshop_guide_name: "Axe",
						Ability1: "axe_berserkers_call",
						// a hidden slot sits among the four a player sees, and the ultimate is
						// pushed past it - so the bar is not simply the first four
						Ability2: "generic_hidden",
						Ability3: "axe_battle_hunger",
						Ability4: "axe_counter_helix",
						Ability5: "axe_culling_blade",
						Ability10: "special_bonus_attack_speed_20"
					}),
					npc_dota_hero_largo: kv({
						Model: "models/heroes/bard/bard_frog_base.vmdl",
						Enabled: "1",
						workshop_guide_name: "Largo",
						Ability1: "largo_catchy_lick"
					}),
					// one the game ships but has not turned on
					npc_dota_hero_unreleased: kv({
						Model: "models/heroes/unreleased.vmdl",
						workshop_guide_name: "Unreleased"
					})
				})
			})
		)
		wearables.set("npc_dota_hero_axe", ["models/heroes/axe/axe_weapon.vmdl"])
	})
	// every hero the game lets you pick, by the name it writes down, each carrying its own face
	assert.deepEqual([...r.preview.Hero.values], ["Axe", "Largo"])
	assert.deepEqual(
		[...r.preview.Hero.icons],
		["heroes/icons/npc_dota_hero_axe_png.vtex_c", "heroes/icons/npc_dota_hero_largo_png.vtex_c"]
	)
	// and it opens on the hero the card is dressed for
	assert.equal(r.preview.Model(), "models/heroes/bard/bard_frog_base.vmdl")

	r.preview.Hero.Pick(0)
	assert.equal(r.preview.Model(), "models/heroes/axe/axe.vmdl")
	assert.deepEqual([...r.preview.Wearables()], ["models/heroes/axe/axe_weapon.vmdl"])
	assert.equal(r.preview.HealthBar.Hero, "npc_dota_hero_axe")

	// and the strip over him is his own bar, the hidden slots left out
	r.tick(true)
	const art = r.roots[0].children
		.flatMap(child => child.children.map(piece => piece.source))
		.join(" ")
	assert.ok(art.includes("axe_berserkers_call"))
	assert.ok(art.includes("axe_culling_blade"))
	assert.ok(!art.includes("generic_hidden"))
	assert.ok(!art.includes("special_bonus"))
	assert.ok(!art.includes("largo_"))
})

test("the hero picker is the hero row's own, and is put away with it", () => {
	const r = runtime()
	assert.equal(r.preview.Hero.IsVisible, true)
	for (let unit = 1; unit < r.preview.Unit.values.length; unit++) {
		r.preview.Unit.SelectedID = unit
		r.preview.Unit.changed()
		assert.equal(r.preview.Hero.IsVisible, false)
		assert.equal(r.preview.ShowWearables.IsVisible, false)
	}
	r.preview.Unit.SelectedID = 0
	r.preview.Unit.changed()
	assert.equal(r.preview.Hero.IsVisible, true)
	assert.equal(r.preview.ShowWearables.IsVisible, true)
})

test("the wearables can be turned off, and the body stands in what the game ships him as", () => {
	const r = runtime()
	assert.equal(r.preview.Wearables().length, 3)
	r.preview.ShowWearables.value = false
	// the body alone - what the game draws before a hero is dressed
	assert.deepEqual([...r.preview.Wearables()], [])
	assert.equal(r.preview.Model(), "models/heroes/bard/bard_frog_base.vmdl")
	r.preview.ShowWearables.value = true
	assert.equal(r.preview.Wearables().length, 3)
})

test("the hero wears his default items and nothing else on the stage does", () => {
	const r = runtime()
	// A hero is a bare body: his hair, armour, belt and weapon are each their own model.
	// the script's array comes out of its own realm, so copy it into one of ours to compare
	assert.deepEqual([...r.preview.Wearables()], [
		"models/heroes/bard/bard_frog_upperbody.vmdl",
		"models/heroes/bard/bard_frog_lowerbody.vmdl",
		"models/heroes/bard/bard_frog_weapon.vmdl"
	])
	for (let unit = 1; unit < r.preview.Unit.values.length; unit++) {
		r.preview.Unit.SelectedID = unit
		assert.deepEqual([...r.preview.Wearables()], [])
	}
})
test("round modifiers use the teleport timer with shadows and item-sized readings", () => {
	const r = runtime()
	r.menu.ModifierMenu.ModeImage.SelectedID = 1
	r.tick(true)
	const group = r.preview.Groups[2]
	assert.ok(group.Canvas.Bounds.w > 0)
	const calls = r.timers.calls
	const timers = calls.filter(([name]) => name === "CircleTimer")
	const readings = calls.filter(([name]) => name === "TextIn").map(call => call[1])
	assert.equal(timers.length, 4)
	// Each icon is a disc at the preview's frame plus its place on the stage, its reading over it.
	for (const [, at, size, style] of timers) {
		assert.ok(style.texture)
		assert.ok(at.x >= r.preview.Frame.x + group.Canvas.Bounds.x)
		assert.ok(at.y >= r.preview.Frame.y + group.Canvas.Bounds.y)
		assert.equal(style.shadow, Math.max(Math.round(size * 0.1), 2))
		assert.equal(style.innerShadow, false)
		assert.equal(style.ringWidth, Math.max(Math.round(size * 0.08), 1))
		assert.ok(style.opacity > 0 && style.opacity <= 1)
		assert.equal(style.color.a, 255)
	}
	assert.deepEqual(readings.filter(text => text.endsWith(".0")).sort(), ["4.0", "5.0", "6.0", "7.0"])
	const size = timers[0][2]
	const textStyle = r.menu.ModifierMenu.TextStyle
	for (const [, text, , style] of calls.filter(([name]) => name === "TextIn")) {
		const cooldown = text.includes(".")
		const minimum = !cooldown && r.menu.ModifierMenu.Size.value === 0 ? 100 : 70
		const scale = Math.max(textStyle.Size.value, minimum) / 100
		assert.equal(style.size, Math.round((size / (cooldown ? 2 : 2.75) + 4) * scale))
		assert.equal(style.weight, textStyle.FontWeight)
		assert.equal(style.family, textStyle.FontFamily)
	}
	assert.deepEqual(timers.map(timer => timer[3].progress).sort((a, b) => a - b), [0.5, 0.625, 0.75, 0.875])
	r.time(3)
	calls.length = 0
	r.tick(true)
	const later = calls.filter(([name]) => name === "CircleTimer")
	assert.deepEqual(later.map(timer => timer[3].progress).sort((a, b) => a - b), [0.25, 0.375, 0.5, 0.625])
	// Nothing of it lands on the group's own surface but the room it takes, which frames the drag area.
	assert.ok(r.roots[2].children.every(child => !child.shown))
})

test("square modifiers wear the ring's band as a frame inside the icon, draining clockwise from twelve o'clock", () => {
	const r = runtime()
	r.tick(true)
	const shown = r.roots[2].children.filter(child => child.shown)
	const icons = shown.filter(child => child.children.some(art => art.source)).map(child => ({ x: child.style.left, y: child.style.top, w: child.style.width, h: child.style.height }))
	// A shape stands a pixel out from what it paints, for its antialiased edge.
	const bands = shown.filter(child => child.style.decorator !== undefined).map(child => ({ x: child.style.left + 1, y: child.style.top + 1, w: child.style.width - 2, h: child.style.height - 2, shape: JSON.parse(child.style.decorator) }))
	assert.equal(icons.length, 4)
	assert.ok(bands.length >= 4)
	const size = Math.min(icons[0].w, icons[0].h)
	const band = Math.max(Math.round(size * 0.08), 1)
	const within = (part, box) => part.x >= box.x && part.y >= box.y && part.x + part.w <= box.x + box.w && part.y + part.h <= box.y + box.h
	for (const strip of bands) {
		// A plain fill in the buff's or debuff's colour, as wide as the ring, and nothing around the icon.
		assert.equal(strip.shape[2], 0)
		assert.equal(strip.shape[7], 100)
		assert.match(strip.shape[1], /^rgba\((242,82,87|82,224,82),/)
		assert.equal(Math.min(strip.w, strip.h), band)
		assert.ok(icons.some(icon => within(strip, icon)))
	}
	// The icons stand left to right in sample order. The last has half its time left, so its frame
	// covers the left half alone: the other half drained clockwise from twelve o'clock.
	icons.sort((a, b) => a.x - b.x)
	const last = icons[3]
	const lastBands = bands.filter(strip => within(strip, last))
	assert.ok(lastBands.length >= 3)
	assert.ok(lastBands.every(strip => strip.x + strip.w <= last.x + Math.round(last.w / 2)))
	assert.ok(lastBands.some(strip => strip.x === last.x && strip.h > band))
	// The first has most of its time left: its right side down from the corner, its bottom and its left are whole.
	const first = icons[0]
	const firstBands = bands.filter(strip => within(strip, first))
	assert.ok(firstBands.some(strip => strip.x + strip.w === first.x + first.w && strip.h > band))
	assert.ok(firstBands.some(strip => strip.y + strip.h === first.y + first.h && strip.w === first.w))
})

test("square frames never paint over themselves as the modifiers run down", () => {
	const r = runtime()
	const box = child => ({ x: child.style.left, y: child.style.top, w: child.style.width, h: child.style.height })
	const within = (part, icon) => part.x >= icon.x && part.y >= icon.y && part.x + part.w <= icon.x + icon.w && part.y + part.h <= icon.y + icon.h
	const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
	for (let now = 1; now <= 8; now++) {
		r.time(now)
		r.tick(true)
		const shown = r.roots[2].children.filter(child => child.shown)
		const icons = shown.filter(child => child.children.some(art => art.source)).map(box)
		const bands = shown.filter(child => child.style.decorator !== undefined).map(child => {
			const strip = box(child)
			return { x: strip.x + 1, y: strip.y + 1, w: strip.w - 2, h: strip.h - 2 }
		})
		assert.equal(icons.length, 4)
		assert.ok(bands.length >= 4)
		for (const icon of icons) {
			const own = bands.filter(strip => within(strip, icon))
			for (let i = 0; i < own.length; i++) {
				for (let j = i + 1; j < own.length; j++) {
					assert.ok(!overlaps(own[i], own[j]), `a frame paints over itself at ${now}`)
				}
			}
		}
		assert.ok(bands.every(strip => icons.some(icon => within(strip, icon))))
	}
})

test("with the animation on, an item returning fades in and is rung in while the modifiers stand still", () => {
	const r = runtime()
	r.menu.Animation.value = true
	const root = r.roots[2]
	const icons = () => root.children.filter(child => child.shown && child.children.some(art => art.source))
	const icon = name => icons().find(child => child.children.some(art => art.source?.endsWith(`/${name}.png`)))
	const opacity = child => Number(child.children[0].style["image-color"].split(",").pop().slice(0, -1))
	const ringing = node => node.children.some(child => child.shown && child.style.decorator !== undefined && child.style.decorator.includes("rgba(94,160,255"))
	// The modifier strip has no motion at all: a cell is whole in its own lane the frame it
	// lands, and the row closes up the frame one ends. Only the item strip animates.
	const rung = () => ringing(root)
	const itemRung = () => ringing(r.roots[1])
	const items = () => r.roots[1].children.filter(child => child.shown && child.children.some(art => art.source)).length
	// A strip opening cold stands whole at once, at full opacity and unrung, while the items cascade.
	r.time(1.5)
	r.tick(true)
	assert.equal(icons().length, 4)
	assert.ok(opacity(icon("crystal_maiden_frostbite")) > 254)
	assert.equal(rung(), false)
	r.time(1.7)
	r.tick(true)
	assert.equal(items(), 6)
	// The stage takes the last modifier away for a while, and the rest close up over it at once.
	r.time(2.5)
	r.tick(true)
	assert.equal(icons().length, 3)
	assert.equal(icon("shivas_guard"), undefined)
	const closed = icon("crystal_maiden_frostbite").style.left
	// It is back whole the frame it lands, and its neighbours are already in their lanes.
	r.time(3.2)
	r.tick(true)
	assert.equal(icons().length, 4)
	assert.ok(opacity(icon("shivas_guard")) > 254)
	assert.equal(rung(), false)
	const settled = icon("crystal_maiden_frostbite").style.left
	assert.ok(settled < closed)
	r.time(4.5)
	r.tick(true)
	assert.equal(icon("crystal_maiden_frostbite").style.left, settled)
	// The items cycle half a turn off the modifiers, so the two never leave together.
	assert.equal(items(), 5)
	assert.equal(itemRung(), false)
	// An item returning is news, and wears the accent ring the modifiers no longer do.
	r.time(5.2)
	r.tick(true)
	r.time(5.25)
	r.tick(true)
	assert.equal(items(), 6)
	assert.equal(itemRung(), true)
	assert.equal(rung(), false)
	// A stage held still stands every cell where it belongs, whole and unrung.
	r.time(6.5)
	r.sdk.PreviewMotion.value = false
	r.tick(true)
	assert.equal(icons().length, 4)
	assert.equal(items(), 6)
	assert.ok(opacity(icon("shivas_guard")) > 254)
	assert.equal(rung(), false)
	r.sdk.PreviewMotion.value = true
})
