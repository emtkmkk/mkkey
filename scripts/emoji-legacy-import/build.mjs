/**
 * @file
 * Google フォームの過去の追加申請から、取り込む候補の一覧と、取り込み API に渡す内容を作る（手元用・一時的）。
 *
 * @remarks
 * TEMP: 移行が終わったら、このディレクトリごと削除する（計画書の手順 12）。
 *
 * 入力（input/ に置く。どちらも git に入れない）
 * - input/sheet.csv：回答シート「絵文字申請」を CSV で書き出したもの（メールアドレスとトークンの列を含むが、出力には書かない）
 * - input/notes.json：申請チャンネルのノートの一覧（notes.sql の結果）
 * - input/exclude.txt：（任意）手で外す絵文字名。1 行 1 つ
 *
 * 出力（output/ に書く。git に入れない）
 * - output/candidates.md：確認用の一覧（取り込む候補と、除いたものとその理由）
 * - output/payload.json：API コンソールで admin/emoji-add-request/import-legacy に貼り付ける内容
 *
 * 対応づけ：申請チャンネルの「この絵文字を登録する(id:N)」のノートの row=N が、回答シートの N 行目（見出しが 1 行目）を指す。
 * 取り込む条件（計画書「過去の追加申請の移行」）
 * - 同じ名前のローカル絵文字が今は無い
 * - 同じ名前・同じ申請者が複数あれば、いちばん新しい 1 件だけ（D5）
 * - 画像がドライブに残っている
 *
 * 使い方：node scripts/emoji-legacy-import/build.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const inputDir = path.join(dir, "input");
const outputDir = path.join(dir, "output");

// #region CSV の読み込み

/**
 * CSV を行と列に分ける（ダブルクォートで囲んだ中の改行・カンマ・"" に対応）。
 *
 * @param {string} text - CSV の中身
 * @returns {string[][]} 行ごとの列
 */
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') {
				quoted = false;
			} else {
				cell += c;
			}
		} else if (c === '"') {
			quoted = true;
		} else if (c === ",") {
			row.push(cell);
			cell = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += c;
		}
	}
	if (cell !== "" || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

// #endregion

// #region 値の変換

/** 回答シートの列名（フォームの質問の文） */
const COL = {
	timestamp: "タイムスタンプ",
	name: "絵文字名（ショートコード）",
	category: "カテゴリ",
	aliases: "タグ・エイリアス",
	licenseQ: "ライセンス情報を入力しますか？",
	copy: "他鯖へのコピー可否",
	license: "ライセンス",
	creator: "作者",
	usage: "使用情報",
	description: "説明",
	message: "他に特に書くことがあれば入力",
};

/** フォームの「他鯖へのコピー可否」の選択肢 → 保存する値 */
const COPY_PERMISSION = {
	決めない: "none",
	コピー可: "allow",
	"許可の後、コピー可": "ask",
	条件付きでコピー可: "conditional",
	コピー不可: "deny",
};

/**
 * フォームの送信時刻を ISO 8601 にする。
 *
 * @remarks
 * 書き出した CSV では「2024/01/07 7:41:40 午後 GMT+9」（12 時間表記・時差つき）になっている。
 * シート上の表示の「2024/01/07 19:41:41」（24 時間表記・日本時間）も読めるようにしておく。
 *
 * @param {string} s - 送信時刻
 * @returns {string | null} ISO 8601（読めなければ null）
 */
function toIso(s) {
	const m = s
		.trim()
		.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})(?: (午前|午後))?(?: GMT([+-]\d{1,2}))?$/);
	if (!m) return null;
	let hour = Number(m[4]);
	// 12 時間表記：午前 12 時は 0 時、午後は 12 を足す（午後 12 時は 12 時のまま）
	if (m[7] === "午前" && hour === 12) hour = 0;
	if (m[7] === "午後" && hour !== 12) hour += 12;
	const offset = Number(m[8] ?? 9);
	const p = (x) => String(x).padStart(2, "0");
	const tz = `${offset >= 0 ? "+" : "-"}${p(Math.abs(offset))}:00`;
	const d = new Date(`${m[1]}-${p(m[2])}-${p(m[3])}T${p(hour)}:${m[5]}:${m[6]}${tz}`);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * シートの 1 行を、取り込み API の 1 件にする。
 *
 * @param {Record<string, string>} r - 列名 → 値
 * @param {{ requester: string | null; fileId: string }} note - 対応するノート
 * @returns {object} 取り込み API の 1 件
 */
function toEntry(r, note) {
	const text = (v) => (v ?? "").trim() || null;
	const isTextOnly = (r[COL.licenseQ] ?? "").includes("文字だけ");
	const copy = COPY_PERMISSION[(r[COL.copy] ?? "").trim()] ?? "none";
	// 「許可の後、コピー可」のとき、フォームでは使用情報の欄に連絡先を書いてもらっていた（GAS と同じ扱い）
	const ask = copy === "ask";
	const license = text(r[COL.license]);
	return {
		name: r[COL.name].trim().toLowerCase(),
		submittedAt: toIso(r[COL.timestamp]),
		requesterUsername: note.requester,
		noteFileId: note.fileId,
		category: text(r[COL.category]),
		aliases: (r[COL.aliases] ?? "").split(/[\s　]+/).filter(Boolean),
		isTextOnly,
		description: text(r[COL.description]),
		message: text(r[COL.message]),
		...(isTextOnly
			? {}
			: {
					copyPermission: ask ? "conditional" : copy,
					askContact: ask ? text(r[COL.usage]) : null,
					usageInfo: ask ? null : text(r[COL.usage]),
					// 「CC BY-NC-SA 4.0 （もこチキ）」の補足は外す。「決めない」はライセンス無し
					licenseName: license && license !== "決めない" ? license.replace(/\s*（.*）$/, "") : null,
					creator: text(r[COL.creator]),
			  }),
	};
}

// #endregion

// #region 組み立て

const rows = parseCsv(fs.readFileSync(path.join(inputDir, "sheet.csv"), "utf8").replace(/^﻿/, ""));
const header = rows[0];
for (const k of Object.values(COL)) {
	if (!header.includes(k)) throw new Error(`回答シートに「${k}」の列がありません`);
}
/** @type {(n: number) => Record<string, string> | null} シートの N 行目（見出しが 1 行目） */
const sheetRow = (n) => (rows[n - 1] ? Object.fromEntries(header.map((h, i) => [h, rows[n - 1][i] ?? ""])) : null);

const notes = JSON.parse(fs.readFileSync(path.join(inputDir, "notes.json"), "utf8"));

/** ノートの row=N と、実際に対応づけた行がずれていたもの（初期は行番号が 1 つずれている。確認用に出す） */
const rowShifted = [];

/** ノートが送信から何ミリ秒以内に投稿されていれば、同じ申請とみなすか */
const MATCH_WINDOW_MS = 10 * 60 * 1000;

/**
 * ノートに対応する回答シートの行を探す。
 *
 * @remarks
 * 「登録する」のノートの row=N は、初期のころ実際の行と 1 つずれている（途中でシートの行が消えたため）。
 * そのため、同じ絵文字名の行のうち、送信時刻がノートの投稿時刻の直前（10 分以内）でいちばん近い行を選ぶ。
 *
 * @param {{ name: string; createdAt: string }} n - ノート
 * @returns {{ rowNo: number; r: Record<string, string> } | null} 行番号（見出しが 1 行目）と中身
 */
function findSheetRow(n) {
	const noteAt = new Date(n.createdAt).getTime();
	let best = null;
	for (let i = 1; i < rows.length; i++) {
		const r = sheetRow(i + 1);
		if (r[COL.name].trim().toLowerCase() !== n.name) continue;
		const iso = toIso(r[COL.timestamp]);
		if (iso == null) continue;
		const diff = noteAt - new Date(iso).getTime();
		if (diff < -60 * 1000 || diff > MATCH_WINDOW_MS) continue;
		if (best == null || Math.abs(diff) < best.diff) best = { rowNo: i + 1, r, diff: Math.abs(diff) };
	}
	return best;
}

/**
 * 手で外す絵文字名（input/exclude.txt に 1 行 1 つ。# から後はメモ）。
 * 確認のうえ取り込まないと決めたものを入れる。
 */
const manualExcludes = readNameList("exclude.txt") ?? new Set();

/**
 * 取り込む絵文字名だけを書いたもの（input/include.txt。書き方は exclude.txt と同じ）。
 * このファイルがあるときは、ここに書いた名前だけを取り込み、ほかは外す。
 */
const manualIncludes = readNameList("include.txt");

/**
 * input/ にある、絵文字名を 1 行 1 つ書いたファイルを読む（# から後はメモ。前後の : は外す）。
 *
 * @param {string} file - ファイル名
 * @returns {Set<string> | null} 絵文字名（ファイルが無ければ null）
 */
function readNameList(file) {
	try {
		return new Set(
			fs
				.readFileSync(path.join(inputDir, file), "utf8")
				.split(/\r?\n/)
				.map((l) => l.replace(/#.*$/, "").trim().replace(/^:|:$/g, ""))
				.filter(Boolean),
		);
	} catch {
		return null;
	}
}

const excluded = [];
const picked = new Map();
for (const n of notes) {
	const label = n.name ? `:${n.name}:` : "（名前なし）";
	if (n.localExists) continue; // 今は同じ名前の絵文字がある（承認済み）。一覧にも出さない
	if (n.name && manualExcludes.has(n.name)) {
		excluded.push({ label, requester: n.requester, reason: "確認のうえ取り込まないことにした（exclude.txt）" });
		continue;
	}
	if (n.name && manualIncludes && !manualIncludes.has(n.name)) {
		excluded.push({ label, requester: n.requester, reason: "確認のうえ取り込まないことにした（include.txt に無い）" });
		continue;
	}
	if (n.name == null || n.row == null) {
		excluded.push({ label, requester: n.requester, reason: "シートの行と対応づけられない（「登録する」のノートが無い。初期のテスト送信など）" });
		continue;
	}
	const found = findSheetRow(n);
	if (found == null) {
		excluded.push({ label, requester: n.requester, reason: "シートに、同じ名前で送信時刻の近い行が無い" });
		continue;
	}
	const { rowNo, r } = found;
	if (rowNo !== n.row) rowShifted.push({ label, noteRow: n.row, sheetRow: rowNo });
	if (toIso(r[COL.timestamp]) == null) {
		excluded.push({ label, requester: n.requester, reason: `シートの ${rowNo} 行目の送信時刻が読めない` });
		continue;
	}
	if (!n.fileExists) {
		excluded.push({ label, requester: n.requester, reason: "画像がドライブに残っていない" });
		continue;
	}
	const key = `${n.name}\t${n.requester}`;
	const prev = picked.get(key);
	if (prev) {
		// 同じ名前・同じ申請者は新しい方だけ残す（D5）。ノートは古い順に並んでいる
		excluded.push({ label, requester: n.requester, reason: `同じ申請者の同じ名前の申請がある（${prev.note.row} 行目を除き、${n.row} 行目を残す）` });
	}
	picked.set(key, { note: { ...n, row: rowNo }, entry: toEntry(r, { requester: n.requesterExists ? n.requester : null, fileId: n.fileId }) });
}

const candidates = [...picked.values()];

// #endregion

// #region 出力

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
	path.join(outputDir, "payload.json"),
	`${JSON.stringify({ entries: candidates.map((c) => c.entry) }, null, "\t")}\n`,
);

const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [
	"# 過去の追加申請の取り込み候補",
	"",
	`取り込む候補：${candidates.length} 件／除いたもの：${excluded.length} 件`,
	"",
	"## 取り込む候補",
	"",
	"| 行 | 絵文字名 | 申請者 | 送信日時 | 文字だけ | コピー可否 | ライセンス | カテゴリ | タグ |",
	"| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
	...candidates.map(({ note, entry: e }) =>
		`| ${note.row} | :${esc(e.name)}: | ${esc(e.requesterUsername ?? "（不明）")} | ${esc(e.submittedAt)} | ${e.isTextOnly ? "はい" : ""} | ${esc(e.copyPermission ?? "")}${e.askContact ? `（連絡先 ${esc(e.askContact)}）` : ""} | ${esc(e.licenseName ?? "")} | ${esc(e.category ?? "")} | ${esc(e.aliases.join(" "))} |`,
	),
	"",
	...(rowShifted.length > 0
		? [
				"## 行番号がずれていたもの（名前と送信時刻で対応づけ直した）",
				"",
				"| 絵文字名 | ノートの row | 対応づけた行 |",
				"| --- | --- | --- |",
				...rowShifted.map((x) => `| ${esc(x.label)} | ${x.noteRow} | ${x.sheetRow} |`),
				"",
		  ]
		: []),
	"## 除いたもの",
	"",
	"| 絵文字名 | 申請者 | 理由 |",
	"| --- | --- | --- |",
	...excluded.map((x) => `| ${esc(x.label)} | ${esc(x.requester ?? "")} | ${esc(x.reason)} |`),
	"",
];
fs.writeFileSync(path.join(outputDir, "candidates.md"), lines.join("\n"));

// #region 画像つきの確認ページ

/**
 * HTML に埋め込む文字を安全にする。
 *
 * @param {unknown} v - 値
 * @returns {string} エスケープした文字
 */
const h = (v) =>
	String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const COPY_LABELS = { allow: "コピー可", deny: "コピー不可", conditional: "条件付きでコピー可", none: "決めない" };

/**
 * 候補 1 件のカード。画像は黒・白の背景の両方で見せる。
 *
 * @param {{ note: any; entry: any }} c - 候補
 * @param {number} i - 番号
 * @returns {string} HTML
 */
function card({ note, entry: e }, i) {
	const copy = e.isTextOnly ? "文字だけ（PD）" : e.askContact ? "許可の後、コピー可" : COPY_LABELS[e.copyPermission] ?? "";
	const rows = [
		["申請者", `@${e.requesterUsername ?? "（不明）"}`],
		["送信日時", new Date(e.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })],
		["カテゴリ", e.category],
		["タグ", e.aliases.join(" ")],
		["コピー可否", copy],
		["ライセンス", e.licenseName],
		["作者", e.creator],
		["連絡先", e.askContact],
		["使用情報", e.usageInfo],
		["説明", e.description],
		["メッセージ", e.message],
	].filter(([, v]) => v);
	const img = note.fileUrl ? `<img src="${h(note.fileUrl)}" alt="" loading="lazy">` : "（画像なし）";
	return `<article>
	<div class="no">#${i + 1}・シート ${note.row} 行目</div>
	<div class="images"><div class="dark">${img}</div><div class="light">${img}</div></div>
	<h2>:${h(e.name)}:</h2>
	<dl>${rows.map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join("")}</dl>
</article>`;
}

const html = `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>過去の追加申請の取り込み候補</title>
<style>
	:root { --bg: #f5f6f8; --card: #fff; --ink: #1d2430; --muted: #667085; --line: #dde1e8; color-scheme: light; }
	@media (prefers-color-scheme: dark) { :root { --bg: #14171d; --card: #1c2129; --ink: #e6e9ef; --muted: #98a2b3; --line: #2d3440; color-scheme: dark; } }
	body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--ink); font-family: "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; font-size: 14px; }
	h1 { font-size: 20px; margin: 0 0 4px; }
	.summary { color: var(--muted); margin: 0 0 20px; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
	article { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
	.no { font-size: 12px; color: var(--muted); }
	.images { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.images > div { display: flex; align-items: center; justify-content: center; height: 88px; border-radius: 6px; padding: 6px; box-sizing: border-box; }
	.dark { background: #222; } .light { background: #f2f2f2; }
	.images img { max-width: 100%; max-height: 100%; object-fit: contain; }
	h2 { font-size: 15px; margin: 0; font-family: ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
	dl { display: grid; grid-template-columns: 6.5em 1fr; gap: 2px 8px; margin: 0; font-size: 13px; }
	dt { color: var(--muted); } dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
	h3 { font-size: 16px; margin: 32px 0 8px; }
	ul { margin: 0; padding-left: 1.2em; color: var(--muted); }
</style>
<h1>過去の追加申請の取り込み候補</h1>
<p class="summary">取り込む ${candidates.length} 件（画像は左が暗い背景、右が明るい背景）／ 除いたもの ${excluded.length} 件</p>
<div class="grid">
${candidates.map(card).join("\n")}
</div>
<h3>除いたもの</h3>
<ul>
${excluded.map((x) => `<li>${h(x.label)}（@${h(x.requester ?? "")}）：${h(x.reason)}</li>`).join("\n")}
</ul>
</html>
`;
fs.writeFileSync(path.join(outputDir, "preview.html"), html);

// #endregion

console.log(`取り込む候補 ${candidates.length} 件、除いたもの ${excluded.length} 件`);
console.log(`→ ${path.join(outputDir, "candidates.md")}`);
console.log(`→ ${path.join(outputDir, "payload.json")}`);

// #endregion
