import { PreviewGroup } from "./group"
import { PreviewGuide, PreviewLimits, SnapPreview } from "./snap"

const arrowX = [-1, 0, 1, 0]
const arrowY = [0, -1, 0, 1]

export class PreviewDrag {
	public readonly Guides: PreviewGuide[] = []
	private active: Nullable<PreviewGroup>
	private nudge: Nullable<(x: number, y: number) => void>
	private readonly arrows = new Map<number, number>()
	private readonly keyDown = (key: VKeys): boolean => this.key(key, true)
	private readonly keyUp = (key: VKeys): boolean => this.key(key, false)

	constructor(
		private readonly stage: MenuSDK.ScreenRect,
		private readonly groups: () => readonly PreviewGroup[],
		private readonly bar: Rectangle
	) {}

	public get Active(): boolean {
		return this.active !== undefined
	}

	private key(key: VKeys, down: boolean): boolean {
		const arrow = key - VKeys.LEFT
		if (this.nudge === undefined || arrow < 0 || arrow >= arrowX.length) {
			return true
		}
		if (!down) {
			this.arrows.delete(arrow)
		} else if (!this.arrows.has(arrow)) {
			this.arrows.set(arrow, hrtime() + 400)
			this.nudge(arrowX[arrow], arrowY[arrow])
		}
		return false
	}

	public Tick(): void {
		if (this.nudge === undefined) {
			return
		}
		const now = hrtime()
		for (const [arrow, repeatAt] of this.arrows) {
			if (now >= repeatAt) {
				this.arrows.set(arrow, now + 50)
				this.nudge(arrowX[arrow], arrowY[arrow])
			}
		}
	}

	public Configure(group: PreviewGroup): void {
		MenuSDK.OpenGroupedSettings(group.Menu.Tree, this.stage, () => {
			const settings = group.Settings
			return settings === undefined
				? [group.Menu.Tree, ...group.Sections]
				: [group.Menu.Tree, settings.Tree, ...group.Sections]
		})
	}

	public Begin(group: PreviewGroup, event: Event): void {
		const settings = group.Settings
		if (
			event.data.button !== 0 ||
			settings === undefined ||
			!this.valid(group.Canvas.Bounds)
		) {
			return
		}
		const originX = settings.PositionX.value
		const originY = settings.PositionY.value
		const bounds = { ...group.Canvas.Bounds }
		const scaleX = GUIInfo.ScaleWidth(1)
		const scaleY = GUIInfo.ScaleHeight(1)
		const { min: minX, max: maxX } = settings.PositionX
		const { min: minY, max: maxY } = settings.PositionY

		this.begin(
			group,
			bounds,
			{
				minX: bounds.x + (minX - originX) * scaleX,
				maxX: bounds.x + (maxX - originX) * scaleX,
				minY: bounds.y + (minY - originY) * scaleY,
				maxY: bounds.y + (maxY - originY) * scaleY
			},
			() => [
				this.barBounds(),
				...this.groups()
					.filter(peer => peer !== group)
					.map(peer => peer.Canvas.Bounds)
			],
			(x, y) => {
				settings.PositionX.value = Math.clamp(
					Math.round(originX + (x - bounds.x) / scaleX) + 0,
					minX,
					maxX
				)
				settings.PositionY.value = Math.clamp(
					Math.round(originY + (y - bounds.y) / scaleY) + 0,
					minY,
					maxY
				)
				return {
					x: bounds.x + (settings.PositionX.value - originX) * scaleX,
					y: bounds.y + (settings.PositionY.value - originY) * scaleY
				}
			},
			event
		)
	}

	private begin(
		target: PreviewGroup,
		bounds: MenuSDK.ScreenRect,
		limits: PreviewLimits,
		targets: () => readonly MenuSDK.ScreenRect[],
		move: (x: number, y: number) => { x: number; y: number },
		event: Event
	): void {
		const startX = Number(event.data.screenX)
		const startY = Number(event.data.screenY)
		if (!Number.isFinite(startX) || !Number.isFinite(startY) || !this.valid(bounds)) {
			return
		}
		this.Cancel()
		const stageX = this.stage.x
		const stageY = this.stage.y
		const motion = MenuSDK.PreviewMotion.value
		let moved = false
		let precise = false
		let lastDX = 0
		let lastDY = 0
		let offsetX = 0
		let offsetY = 0
		let actual = { x: bounds.x, y: bounds.y }
		MenuSDK.PreviewMotion.value = false
		MenuSDK.HideChipTooltip()
		this.active = target
		target.Dragging = true
		this.nudge = (x, y) => {
			actual = move(
				Math.clamp(
					actual.x + x * GUIInfo.ScaleWidth(1),
					limits.minX,
					limits.maxX
				),
				Math.clamp(
					actual.y + y * GUIInfo.ScaleHeight(1),
					limits.minY,
					limits.maxY
				)
			)
			// Rebase the mouse at the exact position, including any previous snap.
			offsetX = actual.x - bounds.x - lastDX
			offsetY = actual.y - bounds.y - lastDY
			precise = moved = true
			this.Guides.length = 0
		}
		// Handle held-element arrows before the menu's keyboard navigation.
		InputEventSDK.on("KeyDown", this.keyDown, -1)
		InputEventSDK.on("KeyUp", this.keyUp, -1)
		MenuSDK.BeginDrag(
			(x, y) => {
				if (!Number.isFinite(x) || !Number.isFinite(y)) {
					return
				}
				const dx = MenuSDK.DpToPx(x) - startX - (this.stage.x - stageX)
				const dy = MenuSDK.DpToPx(y) - startY - (this.stage.y - stageY)
				lastDX = dx
				lastDY = dy
				if (!moved && Math.hypot(dx, dy) < MenuSDK.DpToPx(2)) {
					return
				}
				moved = true
				const next = {
					...bounds,
					x: Math.clamp(bounds.x + dx + offsetX, limits.minX, limits.maxX),
					y: Math.clamp(bounds.y + dy + offsetY, limits.minY, limits.maxY)
				}
				if (precise) {
					actual = move(next.x, next.y)
					return
				}
				const peers = targets()
				const snapped = SnapPreview(next, this.stage, peers, limits)
				actual = move(snapped.x, snapped.y)
				// Show only guides reachable with the persisted offsets' pixel rounding.
				const guides = SnapPreview(
					{ ...next, ...actual },
					this.stage,
					peers,
					limits,
					Math.max(GUIInfo.ScaleWidth(1), GUIInfo.ScaleHeight(1)) / 2 + 0.5
				)
				this.Guides.splice(0, this.Guides.length, ...guides.guides)
			},
			() => {
				InputEventSDK.removeListener("KeyDown", this.keyDown)
				InputEventSDK.removeListener("KeyUp", this.keyUp)
				this.arrows.clear()
				this.nudge = undefined
				target.Dragging = false
				this.active = undefined
				this.Guides.length = 0
				MenuSDK.PreviewMotion.value = motion
			}
		)
		event.stopPropagation()
	}

	private barBounds(): MenuSDK.ScreenRect {
		return {
			x: this.bar.x,
			y: this.bar.y,
			w: this.bar.Width,
			h: this.bar.Height
		}
	}

	private valid(bounds: MenuSDK.ScreenRect): boolean {
		return (
			Number.isFinite(bounds.x) &&
			Number.isFinite(bounds.y) &&
			bounds.w > 0 &&
			bounds.h > 0
		)
	}

	public Resize(group: PreviewGroup, event: Event): void {
		const delta = Number(event.data.wheel_delta_y ?? 0)
		if (this.active !== undefined || !Number.isFinite(delta) || delta === 0) {
			return
		}
		const slider = event.data.ctrlKey ? group.Menu.TextStyle.Size : group.Menu.Size
		const step = event.data.ctrlKey ? 5 : 1
		slider.value = Math.clamp(
			slider.value - Math.sign(delta) * step,
			slider.min,
			slider.max
		)
		event.stopPropagation()
	}

	public Cancel(): void {
		if (this.active !== undefined) {
			MenuSDK.EndDrag()
		}
		this.Guides.length = 0
	}
}
