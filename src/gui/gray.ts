import { DecodePngGray } from "./png"
import { ArtWash, GrayImage } from "./types"

/**
 * Washed copies of the game's own icons, cut to the box each is drawn in, for the wash the game
 * draws an icon in while its owner cannot pay for it: grayed first, then coloured.
 *
 * Neither step can be a filter. The element's tint is applied before its filters, so tinted art
 * put through `grayscale` comes out gray; and the host parses `hue-rotate` and `saturate` but
 * renders neither, so a gray cannot be coloured after the fact - what it does render, sepia and
 * the channel-uniform ones, can only make a gray warm. What is left is to make the pixels here.
 * An icon is read out of the game's files, decoded, grayed, graded in the wash, cut to its box
 * and handed to the host as a small image of the script's own.
 *
 * The icons are Source 2 textures: a resource whose DATA block names the size and format, with
 * the pixels after it, mips smallest first and the full one last. Spell and item icons are DXT5
 * with the one mip, and an opaque one is compiled as YCoCg: its luminance rides the alpha block
 * and the colour block carries the chroma and a scale, which the edit-info block records as the
 * "YCoCg Conversion" - read here through the LZ4 it is packed in. The newer icons carry a PNG
 * instead, read by the decoder beside this; the other plain formats are read too, and anything
 * else - LZ4-packed mips, BC7 - is answered with nothing, and the caller tints the coloured art
 * instead. The copy is a plain RGBA PNG: the host loads a gray-and-alpha one as two channels
 * and shows it wrong.
 */

/** The formats the reader understands, as the texture header numbers them. */
const enum EFormat {
	DXT1 = 1,
	DXT5 = 2,
	RGBA8888 = 4,
	PNG = 16,
	BGRA8888 = 28
}

/** The extra-data record that says the mips are LZ4-packed, which this reader does not unpack. */
const COMPRESSED_MIPS = 4
/** "DATA", "RED2" and "REDI", as the block table writes them. */
const DATA_BLOCK = 0x44415441
const RED2_BLOCK = 0x52454432
const REDI_BLOCK = 0x52454449
/** What the edit info calls the YCoCg compile, as bytes. */
const YCOCG_MARK = [0x59, 0x43, 0x6f, 0x43, 0x67]
/** How the KV3 edit info says its body is packed: not at all, or as one LZ4 block. */
const KV3_PLAIN = 0
const KV3_LZ4 = 1

/**
 * How many icons are decoded in one frame at most; the rest wait a frame each, tinted meanwhile.
 * A DXT icon is under a millisecond, a PNG one several, and a fight can bring a strip of them.
 */
const DECODES_PER_FRAME = 2
/** How many decoded icons and how many cut copies are kept; the oldest go first. */
const DECODED_KEPT = 128
const COPIES_KEPT = 512

/** The luminance of a colour, rounded to a byte, with the weights the graying filter uses. */
function luminance(r: number, g: number, b: number): number {
	return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
}

/** A channel held to a byte. */
function byte(value: number): number {
	return value < 0 ? 0 : value > 255 ? 255 : value
}

/** How many bytes the full mip of a texture takes, or 0 for a format the reader does not know. */
function mipBytes(format: number, width: number, height: number): number {
	const blocks = Math.ceil(width / 4) * Math.ceil(height / 4)
	switch (format) {
		case EFormat.DXT1:
			return blocks * 8
		case EFormat.DXT5:
			return blocks * 16
		case EFormat.RGBA8888:
		case EFormat.BGRA8888:
			return width * height * 4
		default:
			return 0
	}
}

/** Whether `mark` occurs in the bytes between `start` and `end`. */
function holds(
	bytes: Uint8Array,
	start: number,
	end: number,
	mark: readonly number[]
): boolean {
	for (let at = start; at + mark.length <= end; at++) {
		let index = 0
		while (index < mark.length && bytes[at + index] === mark[index]) {
			index++
		}
		if (index === mark.length) {
			return true
		}
	}
	return false
}

/**
 * An LZ4 block between `start` and `end` unpacked into `length` bytes, or nothing when it does
 * not come out to that: runs of literals and copies from what was already written.
 */
function unpackLz4(
	bytes: Uint8Array,
	start: number,
	end: number,
	length: number
): Nullable<Uint8Array> {
	const out = new Uint8Array(length)
	let at = start
	let put = 0
	while (at < end) {
		const token = bytes[at++]
		let literals = token >> 4
		if (literals === 15) {
			let more = 255
			while (more === 255 && at < end) {
				more = bytes[at++]
				literals += more
			}
		}
		if (at + literals > end || put + literals > length) {
			return undefined
		}
		out.set(bytes.subarray(at, at + literals), put)
		at += literals
		put += literals
		if (at >= end) {
			break
		}
		const offset = bytes[at] | (bytes[at + 1] << 8)
		at += 2
		let run = (token & 15) + 4
		if ((token & 15) === 15) {
			let more = 255
			while (more === 255 && at < end) {
				more = bytes[at++]
				run += more
			}
		}
		if (offset === 0 || offset > put || put + run > length) {
			return undefined
		}
		for (let index = 0; index < run; index++, put++) {
			out[put] = out[put - offset]
		}
	}
	return put === length ? out : undefined
}

/**
 * Whether the texture's edit info records the YCoCg compile. A RED2 block is a KV3 document
 * whose body is one LZ4 block at its end, sized in its header; a REDI block, and a KV3 body
 * that is not packed, are searched as they are. An edit info this cannot read answers false.
 */
function compiledYCoCg(
	bytes: Uint8Array,
	kind: number,
	start: number,
	size: number
): boolean {
	const end = start + size
	if (kind === REDI_BLOCK || size < 60) {
		return holds(bytes, start, end, YCOCG_MARK)
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset)
	const method = view.getUint32(start + 20, true)
	if (method === KV3_PLAIN) {
		return holds(bytes, start, end, YCOCG_MARK)
	}
	if (method !== KV3_LZ4) {
		return false
	}
	const unpacked = view.getUint32(start + 48, true)
	const packed = view.getUint32(start + 52, true)
	if (packed === 0 || packed > size || unpacked === 0 || unpacked > 1 << 20) {
		return false
	}
	const body = unpackLz4(bytes, end - packed, end, unpacked)
	if (body !== undefined) {
		return holds(body, 0, body.length, YCOCG_MARK)
	}
	// a stream this could not unpack still keeps the first run of any string as it is
	return holds(bytes, end - packed, end, YCOCG_MARK)
}

/**
 * A DXT texture's luminance and alpha. Every four-by-four block carries two 5-6-5 colours and
 * two bits a texel choosing between them and their thirds; DXT5 puts eight bytes of alpha before
 * that - two alphas and three bits a texel - where DXT1's alpha is the one colour it may drop.
 * A YCoCg texture is DXT5 whose alpha is the luminance and whose colour is the chroma - the
 * orange and green differences, offset by half, over a scale the blue carries.
 */
function decodeDxt(
	bytes: Uint8Array,
	start: number,
	image: GrayImage,
	dxt5: boolean,
	yCoCg: boolean
): void {
	const { width, height, luma, alpha, rgba } = image
	const columns = Math.ceil(width / 4)
	const rows = Math.ceil(height / 4)
	const stride = dxt5 ? 16 : 8
	const reds = [0, 0, 0, 0]
	const greens = [0, 0, 0, 0]
	const blues = [0, 0, 0, 0]
	const lumas = [0, 0, 0, 0]
	const alphas = [0, 0, 0, 0, 0, 0, 0, 0]
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			let at = start + (row * columns + column) * stride
			let alphaLow = 0
			let alphaHigh = 0
			if (dxt5) {
				const a0 = bytes[at]
				const a1 = bytes[at + 1]
				alphas[0] = a0
				alphas[1] = a1
				if (a0 > a1) {
					for (let step = 1; step <= 6; step++) {
						alphas[step + 1] = Math.round(((7 - step) * a0 + step * a1) / 7)
					}
				} else {
					for (let step = 1; step <= 4; step++) {
						alphas[step + 1] = Math.round(((5 - step) * a0 + step * a1) / 5)
					}
					alphas[6] = 0
					alphas[7] = 255
				}
				alphaLow = bytes[at + 2] | (bytes[at + 3] << 8) | (bytes[at + 4] << 16)
				alphaHigh = bytes[at + 5] | (bytes[at + 6] << 8) | (bytes[at + 7] << 16)
				at += 8
			}
			const c0 = bytes[at] | (bytes[at + 1] << 8)
			const c1 = bytes[at + 2] | (bytes[at + 3] << 8)
			for (const [entry, packed] of [
				[0, c0],
				[1, c1]
			]) {
				const r = (packed >> 11) & 31
				const g = (packed >> 5) & 63
				const b = packed & 31
				reds[entry] = (r << 3) | (r >> 2)
				greens[entry] = (g << 2) | (g >> 4)
				blues[entry] = (b << 3) | (b >> 2)
			}
			// DXT5's colours always blend in thirds; DXT1's blend in halves once the first is not
			// the greater, and its fourth entry is then a hole
			const thirds = dxt5 || c0 > c1
			for (const channel of [reds, greens, blues]) {
				channel[2] = thirds
					? Math.round((2 * channel[0] + channel[1]) / 3)
					: Math.round((channel[0] + channel[1]) / 2)
				channel[3] = thirds ? Math.round((channel[0] + 2 * channel[1]) / 3) : 0
			}
			if (!yCoCg) {
				for (let entry = 0; entry < 4; entry++) {
					lumas[entry] = luminance(reds[entry], greens[entry], blues[entry])
				}
			}
			const indices =
				bytes[at + 4] |
				(bytes[at + 5] << 8) |
				(bytes[at + 6] << 16) |
				(bytes[at + 7] << 24)
			for (let texel = 0; texel < 16; texel++) {
				const x = column * 4 + (texel & 3)
				const y = row * 4 + (texel >> 2)
				if (x >= width || y >= height) {
					continue
				}
				const choice = (indices >>> (texel * 2)) & 3
				const pixel = y * width + x
				let cover = 255
				if (dxt5) {
					const bits =
						texel < 8
							? alphaLow >>> (texel * 3)
							: alphaHigh >>> ((texel - 8) * 3)
					cover = alphas[bits & 7]
				} else if (!thirds && choice === 3) {
					cover = 0
				}
				if (yCoCg) {
					const scale = (blues[choice] >> 3) + 1
					const orange = (reds[choice] - 128) / scale
					const green = (greens[choice] - 128) / scale
					const r = byte(cover + orange - green)
					const g = byte(cover + green)
					const b = byte(cover - orange - green)
					luma[pixel] = luminance(r, g, b)
					alpha[pixel] = 255
					if (rgba !== undefined) {
						rgba.set(
							[Math.round(r), Math.round(g), Math.round(b), 255],
							pixel * 4
						)
					}
				} else {
					luma[pixel] = lumas[choice]
					alpha[pixel] = cover
					if (rgba !== undefined) {
						rgba.set(
							[reds[choice], greens[choice], blues[choice], cover],
							pixel * 4
						)
					}
				}
			}
		}
	}
}

/** A texture of four bytes a pixel, red first or blue first. */
function decodePlain(
	bytes: Uint8Array,
	start: number,
	image: GrayImage,
	blueFirst: boolean
): void {
	const { luma, alpha, rgba } = image
	const count = image.width * image.height
	for (let pixel = 0, at = start; pixel < count; pixel++, at += 4) {
		const r = bytes[blueFirst ? at + 2 : at]
		const g = bytes[at + 1]
		const b = bytes[blueFirst ? at : at + 2]
		luma[pixel] = luminance(r, g, b)
		alpha[pixel] = bytes[at + 3]
		if (rgba !== undefined) {
			rgba.set([r, g, b, alpha[pixel]], pixel * 4)
		}
	}
}

/**
 * The luminance and alpha of a Source 2 texture, read from its bytes, or nothing for one the
 * reader does not understand.
 */
export function DecodeTexture(
	buffer: ArrayBuffer,
	retainColor = false
): Nullable<GrayImage> {
	const length = buffer.byteLength
	if (length < 16) {
		return undefined
	}
	const view = new DataView(buffer)
	const raw = new Uint8Array(buffer)
	const resourceSize = view.getUint32(0, true)
	const blockCount = view.getUint32(12, true)
	let block = 8 + view.getUint32(8, true)
	let data = -1
	let dataSize = 0
	let yCoCg = false
	for (let index = 0; index < blockCount; index++, block += 12) {
		if (block + 12 > length) {
			return undefined
		}
		const kind = view.getUint32(block, false)
		const blockStart = block + 4 + view.getUint32(block + 4, true)
		const blockSize = view.getUint32(block + 8, true)
		if (blockStart + blockSize > length) {
			return undefined
		}
		if (kind === DATA_BLOCK) {
			data = blockStart
			dataSize = blockSize
		} else if (kind === RED2_BLOCK || kind === REDI_BLOCK) {
			yCoCg = compiledYCoCg(raw, kind, blockStart, blockSize)
		}
	}
	if (data < 0 || dataSize < 40 || data + 40 > length) {
		return undefined
	}
	const width = view.getUint16(data + 20, true)
	const height = view.getUint16(data + 22, true)
	const format = view.getUint8(data + 26)
	const extraCount = view.getUint32(data + 36, true)
	let extra = data + 32 + view.getUint32(data + 32, true)
	for (let index = 0; index < extraCount; index++, extra += 12) {
		if (extra + 12 > length) {
			return undefined
		}
		if (view.getUint32(extra, true) === COMPRESSED_MIPS) {
			return undefined
		}
	}
	if (width === 0 || height === 0 || width > 4096 || height > 4096) {
		return undefined
	}
	const pixels = Math.max(data + dataSize, resourceSize)
	if (format === EFormat.PNG) {
		// the texture carries its image as a PNG file, which begins where the pixels would
		const png = DecodePngGray(raw, pixels, length, retainColor)
		return png !== undefined && png.width === width && png.height === height
			? png
			: undefined
	}
	const bytes = mipBytes(format, width, height)
	if (bytes === 0) {
		return undefined
	}
	// the mips are stored smallest first, so the full one is the last of the pixel data
	const start = length - bytes
	if (start < pixels) {
		return undefined
	}
	const image: GrayImage = {
		width,
		height,
		luma: new Uint8Array(width * height),
		alpha: new Uint8Array(width * height),
		rgba: retainColor ? new Uint8Array(width * height * 4) : undefined
	}
	if (format === EFormat.DXT1 || format === EFormat.DXT5) {
		decodeDxt(
			raw,
			start,
			image,
			format === EFormat.DXT5,
			yCoCg && format === EFormat.DXT5
		)
	} else {
		decodePlain(raw, start, image, format === EFormat.BGRA8888)
	}
	return image
}

/**
 * The image cut to a box: every pixel of the cut the mean of the source pixels it stands for,
 * which is the whole-pixel cut the host makes of the art itself.
 */
export function CutGray(source: GrayImage, width: number, height: number): GrayImage {
	if (source.width === width && source.height === height) {
		return source
	}
	const luma = new Uint8Array(width * height)
	const alpha = new Uint8Array(width * height)
	for (let y = 0; y < height; y++) {
		const top = Math.floor((y * source.height) / height)
		const bottom = Math.max(Math.floor(((y + 1) * source.height) / height), top + 1)
		for (let x = 0; x < width; x++) {
			const left = Math.floor((x * source.width) / width)
			const right = Math.max(Math.floor(((x + 1) * source.width) / width), left + 1)
			let lumaSum = 0
			let alphaSum = 0
			for (let row = top; row < bottom; row++) {
				for (let column = left; column < right; column++) {
					const from = row * source.width + column
					lumaSum += source.luma[from]
					alphaSum += source.alpha[from]
				}
			}
			const count = (bottom - top) * (right - left)
			const pixel = y * width + x
			luma[pixel] = Math.round(lumaSum / count)
			alpha[pixel] = Math.round(alphaSum / count)
		}
	}
	return { width, height, luma, alpha }
}

/** The grades by their two colours: what every gray comes out as, three bytes a step. */
const grades = new Map<string, Uint8Array>()

/**
 * The colour every gray of the art comes out as under a wash: black up to `mid` at a mid gray,
 * then on to `top` at white. A multiply by a colour is the grade through half of it to itself.
 */
export function WashGrade(wash: ArtWash): Uint8Array {
	const key = `${wash.mid.data32}|${wash.top.data32}`
	let grade = grades.get(key)
	if (grade === undefined) {
		grade = new Uint8Array(256 * 3)
		const { mid, top } = wash
		for (let gray = 0; gray < 256; gray++) {
			const at = gray * 3
			if (gray <= 128) {
				const share = gray / 128
				grade[at] = Math.round(mid.r * share)
				grade[at + 1] = Math.round(mid.g * share)
				grade[at + 2] = Math.round(mid.b * share)
			} else {
				const share = (gray - 128) / 127
				grade[at] = Math.round(mid.r + (top.r - mid.r) * share)
				grade[at + 1] = Math.round(mid.g + (top.g - mid.g) * share)
				grade[at + 2] = Math.round(mid.b + (top.b - mid.b) * share)
			}
		}
		grades.set(key, grade)
	}
	return grade
}

let crcTable: Nullable<Uint32Array>

/** The CRC of a run of bytes, as PNG chunks carry it. */
function crc32(bytes: Uint8Array, start: number, end: number): number {
	if (crcTable === undefined) {
		crcTable = new Uint32Array(256)
		for (let n = 0; n < 256; n++) {
			let entry = n
			for (let k = 0; k < 8; k++) {
				entry = entry & 1 ? 0xedb88320 ^ (entry >>> 1) : entry >>> 1
			}
			crcTable[n] = entry >>> 0
		}
	}
	let c = 0xffffffff
	for (let index = start; index < end; index++) {
		c = crcTable[(c ^ bytes[index]) & 0xff] ^ (c >>> 8)
	}
	return (c ^ 0xffffffff) >>> 0
}

/** The largest run of bytes one stored deflate block holds. */
const STORED_BLOCK = 65535

/**
 * The image graded in a wash, as an RGBA PNG. The pixel stream is deflated as stored blocks -
 * no compression, which needs no compressor - and the file is a couple of kilobytes for a
 * cell-sized copy, which is the size these are made at.
 */
export function EncodeWashPng(image: GrayImage, grade: Uint8Array): Uint8Array {
	const { width, height, luma, alpha } = image
	const rowBytes = 1 + width * 4
	const raw = new Uint8Array(rowBytes * height)
	for (let y = 0; y < height; y++) {
		let put = y * rowBytes + 1
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x
			const step = luma[pixel] * 3
			raw[put++] = grade[step]
			raw[put++] = grade[step + 1]
			raw[put++] = grade[step + 2]
			raw[put++] = alpha[pixel]
		}
	}
	return encodePng(width, height, raw)
}

/** A full-colour icon copied from the game's files, independent of streamed GPU mips. */
export function EncodeRgbaPng(
	width: number,
	height: number,
	rgba: Uint8Array
): Uint8Array {
	const stride = 1 + width * 4
	const raw = new Uint8Array(stride * height)
	for (let y = 0; y < height; y++) {
		raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1)
	}
	return encodePng(width, height, raw)
}

function encodePng(width: number, height: number, raw: Uint8Array): Uint8Array {
	const blocks = Math.max(Math.ceil(raw.length / STORED_BLOCK), 1)
	const zlib = new Uint8Array(2 + blocks * 5 + raw.length + 4)
	zlib[0] = 0x78
	zlib[1] = 0x01
	let at = 2
	for (let index = 0; index < blocks; index++) {
		const start = index * STORED_BLOCK
		const size = Math.min(raw.length - start, STORED_BLOCK)
		zlib[at++] = index === blocks - 1 ? 1 : 0
		zlib[at++] = size & 0xff
		zlib[at++] = size >> 8
		zlib[at++] = ~size & 0xff
		zlib[at++] = (~size >> 8) & 0xff
		zlib.set(raw.subarray(start, start + size), at)
		at += size
	}
	let a = 1
	let b = 0
	for (const value of raw) {
		a = (a + value) % 65521
		b = (b + a) % 65521
	}
	new DataView(zlib.buffer).setUint32(at, ((b << 16) | a) >>> 0, false)
	const header = new Uint8Array(13)
	const headerView = new DataView(header.buffer)
	headerView.setUint32(0, width, false)
	headerView.setUint32(4, height, false)
	header[8] = 8
	header[9] = 6
	const png = new Uint8Array(8 + (12 + 13) + (12 + zlib.length) + 12)
	png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
	let end = 8
	for (const [type, body] of [
		["IHDR", header],
		["IDAT", zlib],
		["IEND", new Uint8Array(0)]
	] as const) {
		const view = new DataView(png.buffer)
		view.setUint32(end, body.length, false)
		for (let index = 0; index < 4; index++) {
			png[end + 4 + index] = type.charCodeAt(index)
		}
		png.set(body, end + 8)
		view.setUint32(
			end + 8 + body.length,
			crc32(png, end + 4, end + 8 + body.length),
			false
		)
		end += 12 + body.length
	}
	return png
}

/** Decoded icons by path; `null` for one the reader could not use, so it is not read again. */
const decoded = new Map<string, GrayImage | null>()
/** Copies by path, size and wash, as the sources the host minted for them; `""` for one that could not be made. */
const copies = new Map<string, string>()
let decodesLeft = DECODES_PER_FRAME

/** Keeps `value` under `key`, dropping the oldest entry once the map holds more than `limit`. */
function keep<T>(
	map: Map<string, T>,
	key: string,
	value: T,
	limit: number,
	drop?: (value: T) => void
) {
	map.set(key, value)
	if (map.size > limit) {
		for (const [oldest, old] of map) {
			map.delete(oldest)
			drop?.(old)
			break
		}
	}
}

/** Opens a frame: the decodes a frame may spend are handed out again. */
export function OpenGrayFrame(): void {
	decodesLeft = DECODES_PER_FRAME
}

/**
 * The source of a copy of the icon at `path` washed in `wash`, `width` by `height` pixels, or
 * nothing while there is none: for a texture the reader cannot use, on a host without the calls,
 * or once the frame has spent its decodes - in which case the next frame answers. Copies are
 * kept, so a cell asking every frame pays once.
 */
export function WashCopy(
	path: string,
	width: number,
	height: number,
	wash: ArtWash
): Nullable<string> {
	if (typeof fread !== "function" || typeof RegisterImageBlob !== "function") {
		return undefined
	}
	const key = `${path}|${width}x${height}|${wash.mid.data32}|${wash.top.data32}`
	const known = copies.get(key)
	if (known !== undefined) {
		return known === "" ? undefined : known
	}
	if (decodesLeft <= 0) {
		return undefined
	}
	decodesLeft--
	let image = decoded.get(path)
	if (image === undefined) {
		const bytes = fread(path, true)
		image = bytes instanceof ArrayBuffer ? (DecodeTexture(bytes) ?? null) : null
		keep(decoded, path, image, DECODED_KEPT)
	}
	const source =
		image === null
			? ""
			: RegisterImageBlob(
					EncodeWashPng(CutGray(image, width, height), WashGrade(wash))
				)
	keep(copies, key, source, COPIES_KEPT, old => {
		if (old !== "" && typeof FreeImageBlob === "function") {
			FreeImageBlob(old)
		}
	})
	return source === "" ? undefined : source
}
