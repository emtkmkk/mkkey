import * as mfm from "mfm-js";
import { defaultStore, noteActions } from "@/store";
import { expandKaTeXMacro } from "@/scripts/katex-macro";
import { str_to_mr } from "@/scripts/convert-mr";

export function preprocess(text: string): string {
		const parsedKaTeXMacro =
			localStorage.getItem("customKaTeXMacroParsed") ?? "{}";
		const maxNumberOfExpansions = 200; // to prevent infinite expansion loops

		let nodes = mfm.parse(text);

		mfm.inspect(nodes, (node) => {
			if (defaultStore.state.enableCustomKaTeXMacro) {
				if (node["type"] === "mathInline" || node["type"] === "mathBlock") {
					node["props"]["formula"] = expandKaTeXMacro(
						node["props"]["formula"],
						parsedKaTeXMacro,
						maxNumberOfExpansions,
					);
				}
			}
			if (node.type === "fn" && node.props.name === "morse") {
				mfm.inspect(node.children,(x) => {
					if (x.type !== "text" || !x.props.text) return;
					x.props.text = str_to_mr(x.props.text);
				});
				node.type = "text";
				node.props.text = mfm.toString(node.children);
				node.children = undefined;
			}
		});

		text = mfm.toString(nodes);

	return text;
}
