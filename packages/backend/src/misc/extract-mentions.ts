/**
 * @packageDocumentation
 *
 * MFM ノードからメンション情報を抽出する。
 *
 * @remarks
 * - **役割**: ノート投稿時に MFM からメンション先を取得し、通知・AP 配信対象の解決に利用する。
 * - テストは test/extract-mentions に存在する。
 *
 * @internal
 */
import * as mfm from "mfm-js";

/**
 * ノード配列からメンションの props 一覧を取得する。
 * @param nodes - MFM ノード配列
 * @returns メンションの props 配列
 * @internal
 */
export function extractMentions(
	nodes: mfm.MfmNode[],
): mfm.MfmMention["props"][] {
	// TODO: 重複を削除
	const mentionNodes = mfm.extract(nodes, (node) => node.type === "mention");
	const mentions = mentionNodes.map((x) => x.props);

	return mentions;
}
