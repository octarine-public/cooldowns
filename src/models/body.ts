/** How tall a body of each height stands at the camera's default distance, this frame. */
const heights = new Map<number, number>()
/** Where the head and the feet being measured stand, in fractional screen pixels. */
const top: [number, number] = [0, 0]
const bottom: [number, number] = [0, 0]

/**
 * A unit's body as it stands on screen under its health bar, which a strip hung below the bar
 * follows.
 *
 * The bar hangs from a point over the unit's head and keeps its size however far the camera
 * stands, so a strip offset from it by a fixed number of pixels is right over the bar and wrong
 * under it: the body shrinks as the camera pulls back, and a strip set under the feet at the
 * default distance is left a long way under them. Under the head a strip's top edge is measured
 * in bodies instead, and stands that many of them under the head whatever the zoom - beside the
 * same part of the body, or the same few steps under the feet. At the default distance that is
 * the offset as it was set.
 */
export class UnitBody {
	/** How far under the bar's top the point it hangs from stands, as the bar is drawn. */
	private head = 0
	/** How far that point really stands from where the bar takes it, which is whole pixels. */
	private readonly slip = new Vector2()
	/** From that point down to the feet: across, the lean perspective gives it, and down. */
	private readonly span = new Vector2()
	/** How far the feet stand under that point at the camera's default distance, or nothing. */
	private reference = 0

	/**
	 * Takes this frame's camera to measure bodies through, and forgets the default camera's
	 * heights, since the camera may have turned since.
	 */
	public static BeginFrame(): void {
		const window = RendererSDK.WindowSize
		Source2SDK.Projection.BeginFrame(window.x, window.y)
		heights.clear()
	}

	/**
	 * How many pixels `height` world units stand at the camera's default distance, under its
	 * angles: what a body that tall measures in the middle of the screen when the strips are set.
	 */
	private static Reference(height: number): number {
		let pixels = heights.get(height)
		if (pixels !== undefined) {
			return pixels
		}
		const distance = CameraSDK.DefaultDistance,
			angles = CameraSDK.Angles,
			window = RendererSDK.WindowSize
		const eye = Vector3.AngleVectors(angles).MultiplyScalarForThis(-distance)
		const feet = RendererSDK.WorldToScreenCustom(
			Vector3.Zero,
			eye,
			distance,
			angles,
			window
		)
		const head = RendererSDK.WorldToScreenCustom(
			new Vector3(0, 0, height),
			eye,
			distance,
			angles,
			window
		)
		pixels =
			distance > 0 && feet !== undefined && head !== undefined
				? (feet.y - head.y) * window.y
				: 0
		heights.set(height, pixels)
		return pixels
	}

	/**
	 * Measures the body standing at `origin` under a bar drawn at `bar`, which hangs from the
	 * point `head`, `height` world units over it.
	 *
	 * The body is measured in fractional pixels rather than off the whole ones the bar is placed
	 * by: a strip a few bodies under the head carries the error of its height that many times
	 * over, and a pixel either way at the feet is a jump of several under them.
	 */
	public Measure(bar: Vector2, head: Vector2, origin: Vector3, height: number): void {
		const projection = Source2SDK.Projection
		if (
			!projection.WorldToScreenXYZ(
				origin.x,
				origin.y,
				origin.z + height,
				top,
				false
			) ||
			!projection.WorldToScreenXYZ(origin.x, origin.y, origin.z, bottom, false)
		) {
			this.reference = 0
			return
		}
		this.head = head.y - bar.y
		this.slip.x = top[0] - head.x
		this.slip.y = top[1] - head.y
		this.span.x = bottom[0] - top[0]
		this.span.y = bottom[1] - top[1]
		this.reference = UnitBody.Reference(height)
	}

	/**
	 * Where a strip set `offset` from the bar stands now, its top edge `rise` over that offset.
	 * Across it takes the lean of the body down to the feet, and stands centred under them past
	 * that. From a body under the head on it is placed off where the head really stands, not
	 * off the whole pixels the bar is, and eases into that above.
	 */
	public Follow(offset: Vector2, rise: number): Vector2 {
		const reference = this.reference,
			drop = offset.y - rise - this.head
		if (reference <= 0 || drop <= 0) {
			return offset
		}
		const bodies = drop / reference,
			near = Math.min(bodies, 1)
		return new Vector2(
			offset.x + (this.slip.x + this.span.x) * near,
			offset.y + this.slip.y * near + (this.span.y - reference) * bodies
		)
	}
}
