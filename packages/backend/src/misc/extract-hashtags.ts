import * as mfm from "mfm-js";
import { unique } from "@/prelude/array.js";

export function extractHashtags(nodes: mfm.MfmNode[]): string[] {
	// extract は MfmNode[] を返すため、絞り込んだ型として扱う
	const hashtagNodes = mfm.extract(
		nodes,
		(node) => node.type === "hashtag",
	) as mfm.MfmHashtag[];
	const hashtags = unique(hashtagNodes.map((x) => x.props.hashtag));

	return hashtags;
}
