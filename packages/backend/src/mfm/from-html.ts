import { URL } from "node:url";
import * as parse5 from "parse5";
import * as TreeAdapter from "../../node_modules/parse5/dist/tree-adapters/default.js";
import { normalizeForSearch } from "../misc/normalize-for-search.js";

const treeAdapter = TreeAdapter.defaultTreeAdapter;

const urlRegex = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+/;
const urlRegexFull = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+$/;

/**
 * 特殊文字（$, [, ]）を削除するヘルパー関数
 * @param str 入力文字列
 * @returns 特殊文字が削除された文字列
 */
function removeSpecialChars(str: string): string {
    return str.replace(/[$\[\]]/g, '');
}

export function fromHtml(html: string, hashtagNames?: string[]): string {
    // APサーバー（例：Pixelfed）はbrタグと改行を使用する
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

        // コメントやドキュメントタイプノードをスキップ
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
                const rbNodes = node.childNodes.filter((x) => x.nodeName === "rb");
                const rtNodes = node.childNodes.filter((x) => x.nodeName === "rt");

                // テキストノードも含めて基底テキストを取得（<rb>がない場合用）
                const textNodes = node.childNodes.filter((x) => treeAdapter.isTextNode(x));

                const rubySegments: string[] = [];

                if (rbNodes.length > 0) {
                    if (rbNodes.length === rtNodes.length) {
                        // <rb> と <rt> の数が一致する場合、ペアごとに処理
                        for (let i = 0; i < rbNodes.length; i++) {
                            let baseText = getText(rbNodes[i]).trim();
                            const rubyText = rtNodes[i] ? getText(rtNodes[i]).trim() : "";

                            // baseText のすべてのスペースを削除
                            baseText = baseText.replace(/ /g, '');

                            // 特殊文字を削除
                            baseText = removeSpecialChars(baseText);
                            const cleanedRubyText = removeSpecialChars(rubyText);

                            // baseText と rubyText が両方空白でない場合のみ追加
                            if (baseText || cleanedRubyText) {
                                if (cleanedRubyText) {
                                    rubySegments.push(`$[ruby ${baseText} ${cleanedRubyText}]`);
                                } else {
                                    rubySegments.push(`$[ruby ${baseText}]`);
                                }
                            }
                        }
                    } else {
                        // <rb> と <rt> の数が一致しない場合、全てを結合して処理
                        let concatenatedBaseText = rbNodes.map(getText).join("").trim();
                        let concatenatedRubyText = rtNodes.map(getText).join("").trim();

                        // concatenatedBaseText のすべてのスペースを削除
                        concatenatedBaseText = concatenatedBaseText.replace(/ /g, '');

                        // 特殊文字を削除
                        concatenatedBaseText = removeSpecialChars(concatenatedBaseText);
                        const cleanedConcatenatedRubyText = removeSpecialChars(concatenatedRubyText);

                        // concatenatedBaseText と cleanedConcatenatedRubyText が両方空白でない場合のみ追加
                        if (concatenatedBaseText || cleanedConcatenatedRubyText) {
                            // スペースの数をカウント
                            const baseSpaceCount = (concatenatedBaseText.match(/ /g) || []).length;
                            const rubySpaceCount = (cleanedConcatenatedRubyText.match(/ /g) || []).length;

                            if (baseSpaceCount === rubySpaceCount && baseSpaceCount > 0) {
                                // スペースの数が同じ場合、空白で分割してペアごとに処理
                                const baseSegments = concatenatedBaseText.split(" ");
                                const rubySegmentsSplit = cleanedConcatenatedRubyText.split(" ");

                                for (let i = 0; i < baseSegments.length; i++) {
                                    const base = removeSpecialChars(baseSegments[i].replace(/ /g, ''));
                                    const ruby = rubySegmentsSplit[i] || '';

                                    if (base || ruby) {
                                        if (ruby) {
                                            rubySegments.push(`$[ruby ${base} ${ruby}]`);
                                        } else {
                                            rubySegments.push(`$[ruby ${base}]`);
                                        }
                                    }
                                }
                            } else {
                                // スペースの数が異なる場合、concatenatedBaseText の空白をすべて削除して1つのruby表現に
                                concatenatedBaseText = concatenatedBaseText.replace(/ /g, '');
                                if (cleanedConcatenatedRubyText) {
                                    rubySegments.push(`$[ruby ${concatenatedBaseText} ${cleanedConcatenatedRubyText}]`);
                                } else {
                                    rubySegments.push(`$[ruby ${concatenatedBaseText}]`);
                                }
                            }
                        }
                    }
                } else {
                    // <rb> が存在しない場合、テキストノードを基底テキストとして扱う
                    let baseText = textNodes.map(getText).join("").trim();
                    const rubyText = rtNodes.map(getText).join("").trim();

                    // baseText と rubyText が両方空白でない場合のみ追加
                    if (baseText || rubyText) {
                        // baseText 内のスペースの数と rubyText 内のスペースの数をカウント
                        const baseSpaceCount = (baseText.match(/ /g) || []).length;
                        const rubySpaceCount = (rubyText.match(/ /g) || []).length;

                        if (baseSpaceCount === rubySpaceCount && baseSpaceCount > 0) {
                            // スペースの数が同じ場合、空白で分割してペアごとに処理
                            const baseSegments = baseText.split(" ");
                            const rubySegmentsSplit = rubyText.split(" ");

                            for (let i = 0; i < baseSegments.length; i++) {
                                const base = removeSpecialChars(baseSegments[i].replace(/ /g, ''));
                                const ruby = removeSpecialChars(rubySegmentsSplit[i] || '');

                                if (base || ruby) {
                                    if (ruby) {
                                        rubySegments.push(`$[ruby ${base} ${ruby}]`);
                                    } else {
                                        rubySegments.push(`$[ruby ${base}]`);
                                    }
                                }
                            }
                        } else {
                            // スペースの数が異なる場合、baseText の空白をすべて削除して1つのruby表現に
                            baseText = baseText.replace(/ /g, '');
                            baseText = removeSpecialChars(baseText);
                            const cleanedRubyText = removeSpecialChars(rubyText);

                            if (cleanedRubyText) {
                                rubySegments.push(`$[ruby ${baseText} ${cleanedRubyText}]`);
                            } else {
                                rubySegments.push(`$[ruby ${baseText}]`);
                            }
                        }
                    }
                }

                // rubySegments が存在する場合、スペースで結合してテキストに追加
                if (rubySegments.length > 0) {
                    if (rbNodes.length > 0) {
                        // <rb> が存在する場合、スペースを挿入せずに結合
                        text += rubySegments.join('');
                    } else {
                        // <rb> が存在しない場合、スペースで区切って結合
                        text += rubySegments.join(' ');
                    }
                } else {
                    // rubySegments が0個の場合、子ノードをそのまま処理
                    appendChildren(node.childNodes);
                }

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
