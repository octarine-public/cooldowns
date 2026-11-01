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
/** What the game draws in place of an icon it does not have, rather than a blank box. */
const EMPTY_SPELL = `${PathData.AbilityImagePath}/empty_png.vtex_c`
/**
 * Whether the game ships a file, asked once per path: an asset does not come and go while the
 * game is running, and the strip reads its icons every frame.
 */
const shipped = new Map<string, boolean>()

function isShipped(path: string): boolean {
	if (typeof fexists !== "function") {
		return true
	}
	let exists = shipped.get(path)
	if (exists === undefined) {
		exists = fexists(path)
		shipped.set(path, exists)
	}
	return exists
}

/**
 * What stands for an icon none of `paths` holds: until a server has been joined the ability data
 * is empty and a spell's texture is only the file it lives in by convention, which the game does
 * not ship for every name. A path to nothing is drawn as a white box, so the game's own empty
 * icon stands instead, and is not retried: a file the game does not have will not appear.
 */
function unshipped(name: string, paths: readonly string[]): string | undefined {
	if (name.startsWith("item_") || paths.some(isShipped)) {
		return undefined
	}
	return EMPTY_SPELL
}

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
		return paths.find(isShipped) ?? unshipped(name, paths) ?? texture
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
	if (source === "") {
		const empty = unshipped(name, paths)
		if (empty !== undefined) {
			return empty
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
