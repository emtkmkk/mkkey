import { URL } from "node:url";
import * as parse5 from "parse5";
import * as TreeAdapter from "../../node_modules/parse5/dist/tree-adapters/default.js";
import { normalizeForSearch } from "../misc/normalize-for-search.js";

const treeAdapter = TreeAdapter.defaultTreeAdapter;

const urlRegex = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+/;
const urlRegexFull = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+$/;

export function fromHtml(html: string, hashtagNames?: string[]): string {
	// some AP servers like Pixelfed use br tags as well as newlines
	html = html.replace(/<br\s?\/?>\r?\n/gi, "\n");
	html = html.replace(/\u200b:(\w+(@[\w.\-]+\.[\w.\-]+)?):\u200b/g, ":$1:");
	
	const normalizedHashtagNames = hashtagNames == null ? undefined : new Set<string>(hashtagNames.map(x => normalizeForSearch(x)));

	const dom = parse5.parseFragment(html);

	let text = "";

	for (const n of dom.childNodes) {
		analyze(n);
	}

	return text.trim();

	function getText(node: TreeAdapter.Node): string {
		if (treeAdapter.isTextNode(node)) return node.value;
		if (!treeAdapter.isElementNode(node)) return "";
		if (node.nodeName === "br") return "\n";

		if (node.childNodes) {
			return node.childNodes.map((n) => getText(n)).join("");
		}

		return "";
	}

	function appendChildren(childNodes: TreeAdapter.ChildNode[]): void {
		if (childNodes) {
			for (const n of childNodes) {
				analyze(n);
			}
		}
	}

	function analyze(node: TreeAdapter.Node) {
		if (treeAdapter.isTextNode(node)) {
			text += node.value;
			return;
		}

		// Skip comment or document type node
		if (!treeAdapter.isElementNode(node)) return;

		switch (node.nodeName) {
			case "br": {
				text += "\n";
				break;
			}

			case "a": {
				const txt = getText(node);
				const rel = node.attrs.find((x) => x.name === "rel");
				const href = node.attrs.find((x) => x.name === "href");

				// ハッシュタグ
				if (
					normalizedHashtagNames && 
					href &&
					normalizedHashtagNames.has(normalizeForSearch(txt))
				) {
					text += txt;
					// メンション
				} else if (txt.startsWith("@") && !rel?.value.match(/^me /)) {
					const part = txt.split("@");

					if (part.length === 2 && href) {
						//#region ホスト名部分が省略されているので復元する
						const acct = `${txt}@${new URL(href.value).hostname}`;
						text += acct;
						//#endregion
					} else if (part.length === 3) {
						text += txt;
					}
					// その他
				} else {
					const generateLink = () => {
						if (!(href || txt)) {
							return "";
						}
						if (!href) {
							return txt;
						}
						if (!txt || txt === href.value) {
							// #6383: Missing text node
							if (href.value.match(urlRegexFull)) {
								return href.value;
							}
								return `<${href.value}>`;
						}
						if (href.value.match(urlRegex) && !href.value.match(urlRegexFull)) {
							return `[${txt}](<${href.value}>)`; // #6846
						}
							return `[${txt}](${href.value})`;
					};

					text += generateLink();
				}
				break;
			}

			case "h1": {
				text += "【";
				appendChildren(node.childNodes);
				text += "】\n";
				break;
			}

			case "b":
			case "strong": {
				text += "**";
				appendChildren(node.childNodes);
				text += "**";
				break;
			}

			case "small": {
				text += "<small>";
				appendChildren(node.childNodes);
				text += "</small>";
				break;
			}

			case "s":
			case "del": {
				text += "~~";
				appendChildren(node.childNodes);
				text += "~~";
				break;
			}

			case "i":
			case "em": {
				text += "<i>";
				appendChildren(node.childNodes);
				text += "</i>";
				break;
			}

			case "ruby": {
				text += "$[ruby"
				appendChildren(node.childNodes.filter((x) => x.nodeName === "rb").slice(0, 1));
				appendChildren(node.childNodes.filter((x) => x.nodeName === "rt").slice(0, 1));
				text += "]";
				break;
			}
			
			case "rb": {
				text += " "
				const beforeText = text;
				appendChildren(node.childNodes);
				text = beforeText + text.slice(beforeText.length).replaceAll(" ", "");
				break;
			}

			case "rt": {
				text += " "
				const beforeText = text;
				appendChildren(node.childNodes);
				text = beforeText + text.slice(beforeText.length).replaceAll(" ", "");
				break;
			}

			// block code (<pre><code>)
			case "pre": {
				if (
					node.childNodes.length === 1 &&
					node.childNodes[0].nodeName === "code"
				) {
					text += "\n```\n";
					text += getText(node.childNodes[0]);
					text += "\n```\n";
				} else {
					appendChildren(node.childNodes);
				}
				break;
			}

			// inline code (<code>)
			case "code": {
				text += "`";
				appendChildren(node.childNodes);
				text += "`";
				break;
			}

			case "blockquote": {
				const t = getText(node);
				if (t) {
					text += "\n> ";
					text += t.split("\n").join("\n> ");
				}
				break;
			}

			case "p":
			case "h2":
			case "h3":
			case "h4":
			case "h5":
			case "h6": {
				text += "\n\n";
				appendChildren(node.childNodes);
				break;
			}

			// other block elements
			case "div":
			case "header":
			case "footer":
			case "article":
			case "li":
			case "dt":
			case "dd": {
				text += "\n";
				appendChildren(node.childNodes);
				break;
			}

			default: {
				// includes inline elements
				// これは参照のリンク 参照に対応している為除外
				if (node.nodeName === "span" && node.attrs.some(attr => attr.name === "class" && attr.value.includes("reference-link-inline"))) break;
				appendChildren(node.childNodes);
				break;
			}
		}
	}
}
