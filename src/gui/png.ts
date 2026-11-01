import { GrayImage } from "./types"

/**
 * A PNG read down to luminance and alpha, for the game textures that carry their image as one:
 * the newer icons are compiled that way rather than as DXT. The host decodes PNGs for itself but
 * lends no decoder out, and the runtime has no inflate, so the deflate is read here: stored,
 * fixed and dynamic blocks, decoded a bit at a time through canonical tables the way zlib's own
 * puff does. Eight-bit gray, gray-alpha, RGB and RGBA scanlines are unfiltered; a palette, a
 * deeper sample or an interlace is answered with nothing.
 */

/** The lengths a length code stands for, and the extra bits it reads, for codes 257 to 285. */
const LENGTH_BASE = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99,
	115, 131, 163, 195, 227, 258
]
const LENGTH_EXTRA = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
]
/** The same for the thirty distance codes. */
const DISTANCE_BASE = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025,
	1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
]
const DISTANCE_EXTRA = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12,
	12, 13, 13
]
/** The order the code-length code's own lengths are sent in. */
const CODE_LENGTH_ORDER = [
	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
]
/** The PNG signature. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** How many samples a pixel of the colour type has, or 0 for a palette, which is not read. */
function channelsOf(colorType: number): number {
	switch (colorType) {
		case 0:
			return 1
		case 2:
			return 3
		case 4:
			return 2
		case 6:
			return 4
		default:
			return 0
	}
}

/** A canonical Huffman code: how many codes there are of each length, and the symbols in code order. */
interface Huffman {
	readonly counts: Uint16Array
	readonly symbols: Uint16Array
}

/** The code for `lengths`, or nothing for a set that is over-subscribed. */
function huffman(lengths: ArrayLike<number>, count: number): Nullable<Huffman> {
	const counts = new Uint16Array(16)
	for (let symbol = 0; symbol < count; symbol++) {
		counts[lengths[symbol]]++
	}
	counts[0] = 0
	let left = 1
	for (let length = 1; length < 16; length++) {
		left = (left << 1) - counts[length]
		if (left < 0) {
			return undefined
		}
	}
	const offsets = new Uint16Array(16)
	for (let length = 1; length < 15; length++) {
		offsets[length + 1] = offsets[length] + counts[length]
	}
	const symbols = new Uint16Array(count)
	for (let symbol = 0; symbol < count; symbol++) {
		if (lengths[symbol] !== 0) {
			symbols[offsets[lengths[symbol]]++] = symbol
		}
	}
	return { counts, symbols }
}

/** A deflate stream being read, least significant bit first. */
class Bits {
	private at: number
	private buffer = 0
	private held = 0

	constructor(
		private readonly bytes: Uint8Array,
		start: number,
		private readonly end: number
	) {
		this.at = start
	}

	/** The next `count` bits as a number, or -1 past the end. */
	public read(count: number): number {
		while (this.held < count) {
			if (this.at >= this.end) {
				return -1
			}
			this.buffer |= this.bytes[this.at++] << this.held
			this.held += 8
		}
		const value = this.buffer & ((1 << count) - 1)
		this.buffer >>>= count
		this.held -= count
		return value
	}

	/** The next symbol of `code`, or -1 for none. */
	public symbol(code: Huffman): number {
		let value = 0
		let first = 0
		let index = 0
		for (let length = 1; length < 16; length++) {
			const bit = this.read(1)
			if (bit < 0) {
				return -1
			}
			value |= bit
			const count = code.counts[length]
			if (value - count < first) {
				return code.symbols[index + (value - first)]
			}
			index += count
			first += count
			first <<= 1
			value <<= 1
		}
		return -1
	}

	/** Drops the bits left of the current byte, for a stored block. */
	public align(): void {
		this.buffer = 0
		this.held = 0
	}

	/** The next whole byte, or -1 past the end. */
	public byte(): number {
		return this.at < this.end ? this.bytes[this.at++] : -1
	}
}

let fixedLengths: Nullable<Huffman>
let fixedDistances: Nullable<Huffman>

/** The codes every fixed block shares, built once. */
function fixed(): [Huffman, Huffman] {
	if (fixedLengths === undefined || fixedDistances === undefined) {
		const lengths = new Uint8Array(288)
		lengths.fill(8, 0, 144)
		lengths.fill(9, 144, 256)
		lengths.fill(7, 256, 280)
		lengths.fill(8, 280, 288)
		const distances = new Uint8Array(30).fill(5)
		fixedLengths = huffman(lengths, 288)
		fixedDistances = huffman(distances, 30)
	}
	return [fixedLengths!, fixedDistances!]
}

/** The two codes of a dynamic block, read from its header, or nothing for a bad one. */
function dynamic(bits: Bits): Nullable<[Huffman, Huffman]> {
	const literals = bits.read(5) + 257
	const distances = bits.read(5) + 1
	const codeLengths = bits.read(4) + 4
	if (literals > 286 || distances > 30 || codeLengths < 4) {
		return undefined
	}
	const orderLengths = new Uint8Array(19)
	for (let slot = 0; slot < codeLengths; slot++) {
		orderLengths[CODE_LENGTH_ORDER[slot]] = bits.read(3)
	}
	const order = huffman(orderLengths, 19)
	if (order === undefined) {
		return undefined
	}
	const lengths = new Uint8Array(literals + distances)
	let index = 0
	while (index < literals + distances) {
		let symbol = bits.symbol(order)
		if (symbol < 0) {
			return undefined
		}
		if (symbol < 16) {
			lengths[index++] = symbol
			continue
		}
		let value = 0
		let repeat: number
		if (symbol === 16) {
			if (index === 0) {
				return undefined
			}
			value = lengths[index - 1]
			repeat = 3 + bits.read(2)
		} else if (symbol === 17) {
			repeat = 3 + bits.read(3)
		} else {
			repeat = 11 + bits.read(7)
		}
		if (index + repeat > literals + distances) {
			return undefined
		}
		while (repeat-- > 0) {
			lengths[index++] = value
		}
		symbol = 0
	}
	const lengthCode = huffman(lengths.subarray(0, literals), literals)
	const distanceCode = huffman(lengths.subarray(literals), distances)
	return lengthCode !== undefined && distanceCode !== undefined
		? [lengthCode, distanceCode]
		: undefined
}

/**
 * The bytes between `start` and `end` inflated into `out`, which is exactly as long as they are
 * expected to come to; whether they did. The two bytes of the zlib header are skipped.
 */
function inflate(
	bytes: Uint8Array,
	start: number,
	end: number,
	out: Uint8Array
): boolean {
	const bits = new Bits(bytes, start + 2, end)
	let put = 0
	let last = 0
	while (last === 0) {
		last = bits.read(1)
		const type = bits.read(2)
		if (last < 0 || type < 0 || type === 3) {
			return false
		}
		if (type === 0) {
			bits.align()
			const length = bits.byte() | (bits.byte() << 8)
			const check = bits.byte() | (bits.byte() << 8)
			if (length < 0 || (length ^ 0xffff) !== check || put + length > out.length) {
				return false
			}
			for (let index = 0; index < length; index++) {
				const value = bits.byte()
				if (value < 0) {
					return false
				}
				out[put++] = value
			}
			continue
		}
		const codes = type === 1 ? fixed() : dynamic(bits)
		if (codes === undefined) {
			return false
		}
		const [lengthCode, distanceCode] = codes
		for (;;) {
			const symbol = bits.symbol(lengthCode)
			if (symbol < 0) {
				return false
			}
			if (symbol < 256) {
				if (put >= out.length) {
					return false
				}
				out[put++] = symbol
				continue
			}
			if (symbol === 256) {
				break
			}
			const lengthIndex = symbol - 257
			if (lengthIndex >= LENGTH_BASE.length) {
				return false
			}
			const length = LENGTH_BASE[lengthIndex] + bits.read(LENGTH_EXTRA[lengthIndex])
			const distanceIndex = bits.symbol(distanceCode)
			if (distanceIndex < 0 || distanceIndex >= DISTANCE_BASE.length) {
				return false
			}
			const distance =
				DISTANCE_BASE[distanceIndex] + bits.read(DISTANCE_EXTRA[distanceIndex])
			if (distance > put || put + length > out.length) {
				return false
			}
			for (let index = 0; index < length; index++, put++) {
				out[put] = out[put - distance]
			}
		}
	}
	return put === out.length
}

/** The Paeth predictor: whichever neighbour is nearest the gradient's guess. */
function paeth(a: number, b: number, c: number): number {
	const p = a + b - c
	const pa = Math.abs(p - a)
	const pb = Math.abs(p - b)
	const pc = Math.abs(p - c)
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * The luminance and alpha of the PNG between `start` and `end`, or nothing for one this cannot
 * read: a bad file, a palette, a deeper sample or an interlace.
 */
export function DecodePngGray(
	bytes: Uint8Array,
	start: number,
	end: number,
	retainColor = false
): Nullable<GrayImage> {
	for (let index = 0; index < SIGNATURE.length; index++) {
		if (bytes[start + index] !== SIGNATURE[index]) {
			return undefined
		}
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset)
	let width = 0
	let height = 0
	let channels = 0
	let packed = 0
	const parts: [number, number][] = []
	for (let at = start + 8; at + 12 <= end; ) {
		const length = view.getUint32(at, false)
		const type = view.getUint32(at + 4, false)
		const body = at + 8
		if (body + length + 4 > end) {
			return undefined
		}
		if (type === 0x49484452) {
			if (length !== 13) {
				return undefined
			}
			// IHDR: the size, and eight bits a sample in a type without a palette, not interlaced
			width = view.getUint32(body, false)
			height = view.getUint32(body + 4, false)
			channels = channelsOf(bytes[body + 9])
			if (bytes[body + 8] !== 8 || channels === 0 || bytes[body + 12] !== 0) {
				return undefined
			}
		} else if (type === 0x49444154) {
			// IDAT: the deflate stream, in as many pieces as it was written in
			parts.push([body, body + length])
			packed += length
		} else if (type === 0x49454e44) {
			break
		}
		at = body + length + 4
	}
	if (
		width === 0 ||
		height === 0 ||
		width > 4096 ||
		height > 4096 ||
		channels === 0 ||
		parts.length === 0
	) {
		return undefined
	}
	let stream = bytes
	let streamStart = parts[0][0]
	let streamEnd = parts[0][1]
	if (parts.length > 1) {
		stream = new Uint8Array(packed)
		let put = 0
		for (const [from, to] of parts) {
			stream.set(bytes.subarray(from, to), put)
			put += to - from
		}
		streamStart = 0
		streamEnd = packed
	}
	const stride = 1 + width * channels
	const raw = new Uint8Array(stride * height)
	if (!inflate(stream, streamStart, streamEnd, raw)) {
		return undefined
	}
	// every scanline is unfiltered in place against the one above, already unfiltered
	for (let y = 0; y < height; y++) {
		const row = y * stride
		const filter = raw[row]
		if (filter === 0) {
			continue
		}
		for (let x = 1; x < stride; x++) {
			const a = x > channels ? raw[row + x - channels] : 0
			const b = y > 0 ? raw[row - stride + x] : 0
			const c = y > 0 && x > channels ? raw[row - stride + x - channels] : 0
			let guess = 0
			if (filter === 1) {
				guess = a
			} else if (filter === 2) {
				guess = b
			} else if (filter === 3) {
				guess = (a + b) >> 1
			} else if (filter === 4) {
				guess = paeth(a, b, c)
			} else {
				return undefined
			}
			raw[row + x] = (raw[row + x] + guess) & 0xff
		}
	}
	const luma = new Uint8Array(width * height)
	const alpha = new Uint8Array(width * height)
	const rgba = retainColor ? new Uint8Array(width * height * 4) : undefined
	for (let y = 0; y < height; y++) {
		let at = y * stride + 1
		for (let x = 0; x < width; x++, at += channels) {
			const pixel = y * width + x
			if (channels >= 3) {
				luma[pixel] = Math.round(
					0.2126 * raw[at] + 0.7152 * raw[at + 1] + 0.0722 * raw[at + 2]
				)
				alpha[pixel] = channels === 4 ? raw[at + 3] : 255
			} else {
				luma[pixel] = raw[at]
				alpha[pixel] = channels === 2 ? raw[at + 1] : 255
			}
			if (rgba !== undefined) {
				rgba[pixel * 4] = raw[at]
				rgba[pixel * 4 + 1] = raw[channels >= 3 ? at + 1 : at]
				rgba[pixel * 4 + 2] = raw[channels >= 3 ? at + 2 : at]
				rgba[pixel * 4 + 3] = alpha[pixel]
			}
		}
	}
	return { width, height, luma, alpha, rgba }
}
