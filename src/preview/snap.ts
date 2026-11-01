export interface PreviewGuide {
	x1: number
	y1: number
	x2: number
	y2: number
	spacing?: boolean
}

export interface PreviewLimits {
	minX: number
	maxX: number
	minY: number
	maxY: number
}

interface Candidate {
	position: number
	guides: PreviewGuide[]
}

function axisSnap(
	axis: "x" | "y",
	bounds: MenuSDK.ScreenRect,
	stage: MenuSDK.ScreenRect,
	targets: readonly MenuSDK.ScreenRect[],
	threshold: number,
	min: number,
	max: number
): Nullable<Candidate> {
	const cross = axis === "x" ? "y" : "x"
	const size = axis === "x" ? "w" : "h"
	const crossSize = axis === "x" ? "h" : "w"
	const extent = bounds[size]
	const position = bounds[axis]
	let best: Nullable<Candidate>
	let distance = threshold
	const offer = (next: number, guides: PreviewGuide[]) => {
		const delta = Math.abs(next - position)
		if (
			next >= min &&
			next <= max &&
			delta <= threshold &&
			(!best || delta < distance)
		) {
			best = { position: next, guides }
			distance = delta
		}
	}
	const line = (at: number, start: number, end: number): PreviewGuide =>
		axis === "x"
			? { x1: at, y1: start, x2: at, y2: end }
			: { x1: start, y1: at, x2: end, y2: at }
	const gap = (start: number, end: number, at: number): PreviewGuide =>
		axis === "x"
			? { x1: start, y1: at, x2: end, y2: at, spacing: true }
			: { x1: at, y1: start, x2: at, y2: end, spacing: true }

	// The stage's own centre wins ties, so a centred layout remains easy to find.
	for (const fraction of [0.5, 0, 1]) {
		const at = stage[size] * fraction
		offer(at - extent * fraction, [line(at, 0, stage[crossSize])])
	}
	for (const target of targets) {
		const start = Math.min(bounds[cross], target[cross])
		const end = Math.max(
			bounds[cross] + bounds[crossSize],
			target[cross] + target[crossSize]
		)
		const center = target[axis] + target[size] / 2
		offer(center - extent / 2, [line(center, start, end)])
		for (const edge of [target[axis], target[axis] + target[size]]) {
			for (const offset of [0, extent]) {
				offer(edge - offset, [line(edge, start, end)])
			}
		}
	}

	// Compare only neighbours in the same row/column, not unrelated distant objects.
	const neighbours = targets
		.filter(
			target =>
				Math.min(
					bounds[cross] + bounds[crossSize],
					target[cross] + target[crossSize]
				) > Math.max(bounds[cross], target[cross])
		)
		.sort((a, b) => a[axis] - b[axis])
	for (let index = 0; index < neighbours.length - 1; index++) {
		const before = neighbours[index]
		const after = neighbours[index + 1]
		const beforeEnd = before[axis] + before[size]
		const afterStart = after[axis]
		const space = afterStart - beforeEnd
		if (space < 0) {
			continue
		}
		const at = Math.max(bounds[cross], before[cross], after[cross])
		if (
			at >=
			Math.min(
				bounds[cross] + bounds[crossSize],
				before[cross] + before[crossSize],
				after[cross] + after[crossSize]
			)
		) {
			continue
		}
		if (space >= extent) {
			const next = beforeEnd + (space - extent) / 2
			offer(next, [gap(beforeEnd, next, at), gap(next + extent, afterStart, at)])
		}
		const earlier = before[axis] - space - extent
		offer(earlier, [
			gap(earlier + extent, before[axis], at),
			gap(beforeEnd, afterStart, at)
		])
		const later = after[axis] + after[size] + space
		offer(later, [
			gap(beforeEnd, afterStart, at),
			gap(after[axis] + after[size], later, at)
		])
	}
	return best
}

export function SnapPreview(
	bounds: MenuSDK.ScreenRect,
	stage: MenuSDK.ScreenRect,
	targets: readonly MenuSDK.ScreenRect[],
	limits: PreviewLimits,
	threshold = MenuSDK.DpToPx(4)
) {
	const visible = targets.filter(
		target =>
			Number.isFinite(target.x) &&
			Number.isFinite(target.y) &&
			target.w > 0 &&
			target.h > 0
	)
	const x = axisSnap("x", bounds, stage, visible, threshold, limits.minX, limits.maxX)
	const y = axisSnap("y", bounds, stage, visible, threshold, limits.minY, limits.maxY)
	return {
		x: x?.position ?? bounds.x,
		y: y?.position ?? bounds.y,
		guides: [...(x?.guides ?? []), ...(y?.guides ?? [])]
	}
}
