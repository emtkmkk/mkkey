import * as mfm from "mfm-js";
import { defaultStore, noteActions } from "@/store";
import { expandKaTeXMacro } from "@/scripts/katex-macro";
import { str_to_mr } from "@/scripts/convert-mr";

export function preprocess(text: string): string {
	const parsedKaTeXMacro =
		localStorage.getItem("customKaTeXMacroParsed") ?? "{}";
	const maxNumberOfExpansions = 200; // to prevent infinite expansion loops

	let _text = text;
	let centerFlg = false;

	for (let i = 0; i < 50; i++) {
		let nodes = mfm.parse(_text);

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
			if (node.type === "fn" && node.props.args?.fps) {
				let fpsnum;
				try {
					fpsnum = parseInt(node.props.args.fps?.replaceAll(/[^0-9.]+/g,""));
				} catch(e) {
					console.log(e);
				}
				if (fpsnum && !Number.isNaN(fpsnum)) {
					node.props.args.speed = (1/fpsnum).toFixed(24) + "s"
					delete node.props.args.fps
				}
			}
			if (node.type === "fn" && node.props.name === "morse") {
				mfm.inspect(node.children, (x) => {
					if (x.type !== "text" || !x.props.text) return;
					x.props.text = str_to_mr(x.props.text);
				});
				node.type = "text";
				node.props.text = mfm.toString(node.children);
				node.children = undefined;
			}
			if (node.type === "fn" && node.props.name === "daku") {
				mfm.inspect(node.children, (x) => {
					if (x.type !== "text" || !x.props.text) return;
					x.props.text = x.props.text
						.split("")
						.map((x) => (/[\s　゛゜]/.test(x) ? x : `${x}゛`))
						.join("");
				});
				node.type = "text";
				node.props.text = mfm.toString(node.children);
				node.children = undefined;
			}
			if (node.type === "fn" && node.props.name === "handaku") {
				mfm.inspect(node.children, (x) => {
					if (x.type !== "text" || !x.props.text) return;
					x.props.text = x.props.text
						.split("")
						.map((x) => (/[\s　゛゜]/.test(x) ? x : `${x}゜`))
						.join("");
				});
				node.type = "text";
				node.props.text = mfm.toString(node.children);
				node.children = undefined;
			}
			if (node.type === "fn" && node.props.name === "space") {
				mfm.inspect(node.children, (x) => {
					if (x.type !== "text" || !x.props.text) return;
					x.props.text = x.props.text
						.split("")
						.map((x) => (/[\s　]/.test(x) ? x : `${x}　`))
						.join("")
						.replace(/(.*)　$/, "$1");
				});
				node.type = "text";
				node.props.text = mfm.toString(node.children);
				node.children = undefined;
			}
			if (
				node.type === "fn" &&
				[
					"b",
					"s",
					"q",
					"i",
					"p",
					"c",
					"bold",
					"small",
					"quote",
					"italic",
					"strike",
					"plain",
					"center",
				].includes(node.props.name)
			) {
				if (node.props.name.length === 1) {
					node.props.name = node.props.name
						.replace(/^b$/, "bold")
						.replace(/^q$/, "quote")
						.replace(/^i$/, "italic")
						.replace(/^p$/, "plain")
						.replace(/^s$/, "small")
						.replace(/^c$/, "center")
				}
				node.type = node.props.name;
				node.props.name = undefined;
			}
			if (
				node.type === "fn" &&
				(node.props.name === "search" || node.props.name === "f")
			) {
				node.type = "search";
				node.props.query = mfm.toString(node.children).replaceAll("\n", " ");
				node.props.content = `${mfm
					.toString(node.children)
					.replaceAll("\n", " ")} [Search]`;
			}
			if (
				node.type === "fn" &&
				node.props.name === "x1"
			) {
				node.props.name = "scale"
			}
			if (
				node.type === "fn" &&
				(node.props.name === "unixtime" || node.props.name === "time")
			) {
				const ctext = mfm.toString(node.children);
				if (
					node.props.name === "time" ||
					(ctext && !Number.isFinite(Number(ctext)))
				) {
					const pdate = Date.parse(ctext);
					if (Number.isFinite(pdate)) {
						node.props.name = "unixtime";
						node.children = [
							{ type: "text", props: { text: Math.floor(pdate / 1000) } },
						];
					}
				}
			}
		});

		text = mfm.toString(nodes);

		if (text === _text) {
			break;
		} else {
			_text = text;
		}
	}

	return text;
}
