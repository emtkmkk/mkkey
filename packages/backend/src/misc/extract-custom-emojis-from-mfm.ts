import * as mfm from "mfm-js";
import { unique } from "@/prelude/array.js";

export function extractCustomEmojisFromMfm(nodes: mfm.MfmNode[]): string[] {
	// extract は MfmNode[] を返すため、絞り込んだ型として扱う
	const emojiNodes = mfm.extract(nodes, (node) => {
		return node.type === "emojiCode" && node.props.name.length <= 180;
	}) as mfm.MfmEmojiCode[];

	return unique(emojiNodes.map((x) => x.props.name));
}
