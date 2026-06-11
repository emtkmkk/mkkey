import sharp from "sharp";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../assets/notification-badges");

for (const f of ["plus.png", "reply.png", "star.png", "face-smile.png"]) {
	const { data } = await sharp(join(dir, f))
		.raw()
		.ensureAlpha()
		.toBuffer({ resolveWithObject: true });
	let transparent = 0;
	let white = 0;
	let black = 0;
	let gray = 0;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		const a = data[i + 3];
		if (a === 0) {
			transparent++;
		} else if (r > 200 && g > 200 && b > 200) {
			white++;
		} else if (r < 30 && g < 30 && b < 30) {
			black++;
		} else {
			gray++;
		}
	}
	const total = data.length / 4;
	console.log(f, {
		transparent: ((transparent / total) * 100).toFixed(1) + "%",
		white: ((white / total) * 100).toFixed(1) + "%",
		black: ((black / total) * 100).toFixed(1) + "%",
		gray: ((gray / total) * 100).toFixed(1) + "%",
	});
}
