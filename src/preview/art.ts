import { DecodeTexture, EncodeRgbaPng } from "../gui/gray"
import { DecodePngGray } from "../gui/png"
import { ForgetArtPixels, RememberArtPixels } from "../gui/rounded"

interface Icon {
	readonly source: string
	readonly retryAt: number
	ready: boolean
}

const ROOT = `${__OCT_PACKAGE_ROOT__}/scripts_files/cooldowns/preview/art`
const RETRY_MS = 5000
const CACHE_LIMIT = 128
const icons = new Map<string, Icon>()

/** Ability metadata includes texture aliases that do not match the ability's name. */
export function PreviewTexture(name: string): string {
	const texture = AbilityData.GetAbilityByName(name)?.TexturePath
	if (
		texture !== undefined &&
		texture !== "" &&
		!texture.endsWith("/empty_png.vtex_c")
	) {
		return texture
	}
	return name.startsWith("item_")
		? `${PathData.ItemImagePath}/${name.slice(5)}_png.vtex_c`
		: `${PathData.AbilityImagePath}/${name}_png.vtex_c`
}

/**
 * Read complete pixels from disk, never from the engine's currently resident texture mip.
 * Bundled samples are preferred; any other hero uses its own installed game texture.
 * A failed or pending load shows a marked placeholder and is retried, not cached forever.
 */
export function PreviewArt(name: string): string {
	const texture = PreviewTexture(name)
	const key = `${name}|${texture}`
	const now = hrtime()
	let icon = icons.get(key)
	if (icon !== undefined) {
		// Refresh insertion order so switching heroes keeps recently used art in the cache.
		icons.delete(key)
		icons.set(key, icon)
		if (icon.source !== "" && (icon.ready || MenuSDK.HostImageReady(icon.source))) {
			icon.ready = true
			return icon.source
		}
		if (now < icon.retryAt) {
			return `${ROOT}/missing.png`
		}
		release(icon)
	}
	const file = name.startsWith("item_") ? name.slice(5) : name
	const paths = [`${ROOT}/${file}.png`, texture]
	// Older hosts can still draw files, but must never receive an invented package path.
	if (typeof fread !== "function" || typeof RegisterImageBlob !== "function") {
		return (
			paths.find(path => typeof fexists === "function" && fexists(path)) ?? texture
		)
	}
	let source = ""
	for (const path of paths) {
		try {
			const bytes = fread(path, true)
			if (bytes === undefined) {
				continue
			}
			const image = path.endsWith(".png")
				? DecodePngGray(new Uint8Array(bytes), 0, bytes.byteLength, true)
				: DecodeTexture(bytes, true)
			if (image?.rgba === undefined || !image.alpha.some(alpha => alpha > 0)) {
				continue
			}
			source = RegisterImageBlob(
				EncodeRgbaPng(image.width, image.height, image.rgba)
			)
			if (source !== "") {
				RememberArtPixels(source, {
					width: image.width,
					height: image.height,
					rgba: image.rgba
				})
				break
			}
		} catch {
			// A missing or damaged candidate must not prevent trying the game's copy.
			continue
		}
	}
	icon = {
		source,
		ready: source !== "" && MenuSDK.HostImageReady(source),
		retryAt: now + RETRY_MS
	}
	icons.set(key, icon)
	if (icons.size > CACHE_LIMIT) {
		for (const [oldest, old] of icons) {
			icons.delete(oldest)
			release(old)
			break
		}
	}
	return icon.ready ? source : `${ROOT}/missing.png`
}

function release(icon: Icon): void {
	ForgetArtPixels(icon.source)
	if (icon.source !== "" && typeof FreeImageBlob === "function") {
		FreeImageBlob(icon.source)
	}
}
