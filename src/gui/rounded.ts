import { DecodeTexture, EncodeRgbaPng, WashGrade } from "./gray"
import { DecodePngGray } from "./png"
import { ArtWash } from "./types"

export interface RgbaImage {
	readonly width: number
	readonly height: number
	readonly rgba: Uint8Array
}

/** Generated preview sources cannot be read back as files. Keep their original pixels. */
const originals = new Map<string, RgbaImage>()
const decoded = new Map<string, { image?: RgbaImage; retryAt: number }>()
const copies = new Map<string, { path: string; source: string; retryAt: number }>()
const RETRY_MS = 5000
let copiesLeft = 2

export function RememberArtPixels(source: string, image: RgbaImage): void {
	originals.set(source, image)
}

export function ForgetArtPixels(source: string): void {
	originals.delete(source)
	for (const [key, copy] of copies) {
		if (copy.path === source) {
			copies.delete(key)
			free(copy.source)
		}
	}
}

export function OpenRoundedFrame(): void {
	copiesLeft = 2
}

/**
 * Centre-crop to the display size, filtering premultiplied colours to preserve transparent
 * edges. Rounded coverage is baked into alpha at that size, with a one-pixel antialias band.
 */
export function RoundedPixels(
	image: RgbaImage,
	width: number,
	height: number,
	radius: number,
	wash?: ArtWash
): Uint8Array {
	const out = new Uint8Array(width * height * 4)
	const scale = Math.max(width / image.width, height / image.height)
	const left = (image.width - width / scale) / 2
	const top = (image.height - height / scale) / 2
	const grade = wash === undefined ? undefined : WashGrade(wash)
	const r = Math.max(0, Math.min(radius, width / 2, height / 2))
	for (let y = 0; y < height; y++) {
		const fromY = top + y / scale
		const toY = Math.min(top + (y + 1) / scale, image.height)
		for (let x = 0; x < width; x++) {
			const qx = Math.abs(x + 0.5 - width / 2) - (width / 2 - r)
			const qy = Math.abs(y + 0.5 - height / 2) - (height / 2 - r)
			const distance =
				Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
				Math.min(Math.max(qx, qy), 0) -
				r
			const coverage = Math.max(0, Math.min(0.5 - distance, 1))
			if (coverage === 0) {
				continue
			}
			const fromX = left + x / scale
			const toX = Math.min(left + (x + 1) / scale, image.width)
			let red = 0,
				green = 0,
				blue = 0,
				alpha = 0
			for (let sy = Math.max(Math.floor(fromY), 0); sy < Math.ceil(toY); sy++) {
				const vertical = Math.min(toY, sy + 1) - Math.max(fromY, sy)
				for (let sx = Math.max(Math.floor(fromX), 0); sx < Math.ceil(toX); sx++) {
					const weight =
						vertical * (Math.min(toX, sx + 1) - Math.max(fromX, sx))
					const pixel = (sy * image.width + sx) * 4
					const a = image.rgba[pixel + 3] * weight
					red += image.rgba[pixel] * a
					green += image.rgba[pixel + 1] * a
					blue += image.rgba[pixel + 2] * a
					alpha += a
				}
			}
			if (alpha === 0) {
				continue
			}
			const at = (y * width + x) * 4
			const gray =
				Math.round((0.2126 * red + 0.7152 * green + 0.0722 * blue) / alpha) * 3
			out[at] = grade === undefined ? Math.round(red / alpha) : grade[gray]
			out[at + 1] =
				grade === undefined ? Math.round(green / alpha) : grade[gray + 1]
			out[at + 2] = grade === undefined ? Math.round(blue / alpha) : grade[gray + 2]
			out[at + 3] = Math.round((alpha / ((toX - fromX) * (toY - fromY))) * coverage)
		}
	}
	return out
}

/** A ready rounded copy, or undefined while the original image should remain visible. */
export function RoundedArt(
	path: string,
	width: number,
	height: number,
	radius: number,
	wash?: ArtWash
): Nullable<string> {
	if (typeof RegisterImageBlob !== "function") {
		return undefined
	}
	const key = `${path}|${width}x${height}|${radius}|${wash?.mid.data32}|${wash?.top.data32}`
	const now = hrtime()
	const known = copies.get(key)
	if (known !== undefined) {
		copies.delete(key)
		copies.set(key, known)
		if (known.source !== "" && MenuSDK.HostImageReady(known.source)) {
			return known.source
		}
		if (now < known.retryAt) {
			return undefined
		}
	}
	if (copiesLeft <= 0) {
		return undefined
	}
	copiesLeft--
	const image = pixels(path, now)
	let source = ""
	if (image !== undefined) {
		source = RegisterImageBlob(
			EncodeRgbaPng(
				width,
				height,
				RoundedPixels(image, width, height, radius, wash)
			)
		)
	}
	if (known !== undefined) {
		free(known.source)
	}
	copies.set(key, { path, source, retryAt: now + RETRY_MS })
	if (copies.size > 512) {
		for (const [oldest, old] of copies) {
			copies.delete(oldest)
			free(old.source)
			break
		}
	}
	return source !== "" && MenuSDK.HostImageReady(source) ? source : undefined
}

function pixels(path: string, now: number): Nullable<RgbaImage> {
	const original = originals.get(path)
	if (original !== undefined) {
		return original
	}
	const known = decoded.get(path)
	if (known !== undefined && (known.image !== undefined || now < known.retryAt)) {
		return known.image
	}
	let image: Nullable<RgbaImage>
	if (typeof fread === "function") {
		try {
			const bytes = fread(path, true)
			if (bytes !== undefined) {
				const result = path.endsWith(".png")
					? DecodePngGray(new Uint8Array(bytes), 0, bytes.byteLength, true)
					: DecodeTexture(bytes, true)
				if (result?.rgba !== undefined) {
					image = {
						width: result.width,
						height: result.height,
						rgba: result.rgba
					}
				}
			}
		} catch {
			image = undefined
		}
	}
	decoded.set(path, { image, retryAt: now + RETRY_MS })
	if (decoded.size > 128) {
		for (const oldest of decoded.keys()) {
			decoded.delete(oldest)
			break
		}
	}
	return image
}

function free(source: string): void {
	if (source !== "" && typeof FreeImageBlob === "function") {
		FreeImageBlob(source)
	}
}
