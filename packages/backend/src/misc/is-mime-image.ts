import { FILE_TYPE_BROWSERSAFE } from "@/const.js";

const dictionary = {
	"safe-file": FILE_TYPE_BROWSERSAFE,
	"sharp-convertible-image": [
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/apng",
		"image/vnd.mozilla.apng",
		"image/webp",
		"image/svg+xml",
		"image/avif",
		"image/x-icon",
		"image/bmp",
	],
	"sharp-animation-convertible-image": [
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/avif",
		"image/svg+xml",
		"image/x-icon",
		"image/bmp",
	],
};

export const isMimeImage = (
	mime: string,
	type: keyof typeof dictionary,
): boolean => dictionary[type].includes(mime);
