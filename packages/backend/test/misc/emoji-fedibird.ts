/**
 * @packageDocumentation
 *
 * `emoji-fedibird`（Fedibird 互換の絵文字情報の変換）の単体テスト。
 *
 * @remarks
 * テストデータの一部は、実際に Fedibird から届いた Emoji オブジェクトを元にしている。
 *
 * @internal
 */
import * as assert from "assert";
import {
	buildCopiedEmojiExtraFields,
	buildMisskeyLicenseFreeText,
	extractFedibirdEmojiFields,
	isFedibirdFieldsChanged,
	normalizeLicenseName,
	parseRelatedLinks,
	stripHostFromCategory,
	toFedibirdColumns,
	toRemoteCategory,
} from "../../src/misc/emoji-fedibird.js";

/** Fedibird の実データ（allow_importing_to_other_servers_ja）を元にしたタグ */
const fedibirdTag = {
	id: "https://fedibird.com/emojis/allow_importing_to_other_servers_ja",
	type: "Emoji",
	name: ":allow_importing_to_other_servers_ja:",
	category: "単語（横長）",
	alternateName: "他サーバーへのインポートを許可します",
	ruby: "たさーばーへのいんぽーとをきょかします",
	copyPermission: "allow",
	license: "https://creativecommons.org/publicdomain/zero/1.0/",
	relatedLinks: [
		"https://www.adobe.com/jp/products/illustrator.html",
		"https://morisawafonts.com/fonts/995/",
	],
	usageInfo: "著作権を放棄しており、自由に利用できます",
	creator: "@noellabo@fedibird.com",
	copyrightNotice: "CC0により「いかなる権利も保有しない」ことを宣言しているため、著作権は放棄しています",
	creditText: "この絵文字はAdobe Illustrator 2025 (29.2.1)で作成されました。",
	_misskey_license: { freeText: "name: 他サーバーへのインポートを許可します, license: CC0, #allow" },
	isBasedOn: "https://misskey.io/emojis/example",
};

describe("emoji-fedibird", () => {
	describe("extractFedibirdEmojiFields", () => {
		it("正常系：Fedibird 形式の項目を取り出す", () => {
			const out = extractFedibirdEmojiFields(fedibirdTag);
			assert.strictEqual(out.alternateName, "他サーバーへのインポートを許可します");
			assert.strictEqual(out.ruby, "たさーばーへのいんぽーとをきょかします");
			assert.deepStrictEqual(out.relatedLinks, fedibirdTag.relatedLinks);
			assert.strictEqual(out.copyrightNotice, fedibirdTag.copyrightNotice);
			assert.strictEqual(out.creditText, fedibirdTag.creditText);
			assert.strictEqual(out.category, "単語（横長）");
			assert.strictEqual(out.isBasedOn, "https://misskey.io/emojis/example");
		});

		it("正常系：_misskey_license.freeText は中身を解釈せずそのまま残す", () => {
			const out = extractFedibirdEmojiFields(fedibirdTag);
			assert.strictEqual(
				out.sourceLicenseText,
				"name: 他サーバーへのインポートを許可します, license: CC0, #allow",
			);
		});

		it("正常系：別名のキー（relatedLink / misskeyLicense）も受け付ける", () => {
			const out = extractFedibirdEmojiFields({
				relatedLink: "https://a.example https://b.example",
				misskeyLicense: { freeText: "PD" },
			});
			assert.deepStrictEqual(out.relatedLinks, ["https://a.example", "https://b.example"]);
			assert.strictEqual(out.sourceLicenseText, "PD");
		});

		it("異常系：型が違う値や空文字は null / 空配列になる", () => {
			const out = extractFedibirdEmojiFields({
				alternateName: 123,
				ruby: "   ",
				relatedLinks: { url: "x" },
				_misskey_license: "文字列",
			});
			assert.strictEqual(out.alternateName, null);
			assert.strictEqual(out.ruby, null);
			assert.deepStrictEqual(out.relatedLinks, []);
			assert.strictEqual(out.sourceLicenseText, null);
		});

		it("境界値：長すぎる表示名は 512 文字に切り詰める", () => {
			const out = extractFedibirdEmojiFields({ alternateName: "あ".repeat(600) });
			assert.strictEqual(out.alternateName?.length, 512);
		});
	});

	describe("parseRelatedLinks", () => {
		it("境界値：21 件以上は 20 件までにする", () => {
			const links = Array.from({ length: 25 }, (_, i) => `https://example.com/${i}`);
			assert.strictEqual(parseRelatedLinks(links).length, 20);
		});

		it("正常系：配列内の空要素を取り除く", () => {
			assert.deepStrictEqual(parseRelatedLinks(["", " https://a.example ", null]), [
				"https://a.example",
			]);
		});
	});

	describe("normalizeLicenseName", () => {
		it("正常系：CC0 の URL は CC0 1.0 Universal にする", () => {
			assert.strictEqual(
				normalizeLicenseName("https://creativecommons.org/publicdomain/zero/1.0/"),
				"CC0 1.0 Universal",
			);
		});

		it("正常系：パブリックドメイン・マークの URL は Public Domain にする", () => {
			assert.strictEqual(
				normalizeLicenseName("https://creativecommons.org/publicdomain/mark/1.0/"),
				"Public Domain",
			);
		});

		it("正常系：http・www・末尾スラッシュ無し・deed 付きでも変換する", () => {
			assert.strictEqual(
				normalizeLicenseName("http://www.creativecommons.org/licenses/by-nc-sa/4.0/deed.ja"),
				"CC BY-NC-SA 4.0",
			);
			assert.strictEqual(
				normalizeLicenseName("https://creativecommons.org/licenses/by/3.0"),
				"CC BY 3.0",
			);
		});

		it("正常系：名前で届いたものはそのまま返す", () => {
			assert.strictEqual(normalizeLicenseName("CC BY 4.0"), "CC BY 4.0");
		});

		it("正常系：表に無い URL はそのまま返す", () => {
			assert.strictEqual(
				normalizeLicenseName("https://example.com/my-license"),
				"https://example.com/my-license",
			);
		});

		it("異常系：空や文字列以外は null", () => {
			assert.strictEqual(normalizeLicenseName(""), null);
			assert.strictEqual(normalizeLicenseName(undefined), null);
			assert.strictEqual(normalizeLicenseName(1), null);
		});
	});

	describe("toRemoteCategory / stripHostFromCategory", () => {
		it("正常系：カテゴリ名にホストを付け、外すと元に戻る", () => {
			const stored = toRemoteCategory("単語（横長）", "fedibird.com");
			assert.strictEqual(stored, "単語（横長） <fedibird.com>");
			assert.strictEqual(stripHostFromCategory(stored, "fedibird.com"), "単語（横長）");
		});

		it("正常系：ホストを渡さなくても末尾の <ホスト> を外す", () => {
			assert.strictEqual(stripHostFromCategory("もこチキ <misskey.io>"), "もこチキ");
		});

		it("正常系：ホスト名が付いていなければそのまま", () => {
			assert.strictEqual(stripHostFromCategory("いぬ", "misskey.io"), "いぬ");
		});

		it("異常系：空のカテゴリは null", () => {
			assert.strictEqual(toRemoteCategory("  ", "a.example"), null);
			assert.strictEqual(stripHostFromCategory(null), null);
			assert.strictEqual(stripHostFromCategory(" <a.example>", "a.example"), null);
		});

		it("境界値：長いカテゴリは 128 文字に切り詰める", () => {
			assert.strictEqual(toRemoteCategory("あ".repeat(200), "a.example")?.length, 128);
		});
	});

	describe("isFedibirdFieldsChanged", () => {
		it("正常系：同じ値なら false、1 つでも違えば true", () => {
			const fields = extractFedibirdEmojiFields(fedibirdTag);
			const saved = toFedibirdColumns(fields);
			assert.strictEqual(isFedibirdFieldsChanged(fields, saved), false);
			assert.strictEqual(isFedibirdFieldsChanged(fields, { ...saved, ruby: "ちがう" }), true);
			assert.strictEqual(
				isFedibirdFieldsChanged(fields, { ...saved, relatedLinks: [] }),
				true,
			);
		});

		it("境界値：古い行（relatedLinks が無い）と空の値は変更なし扱い", () => {
			const fields = extractFedibirdEmojiFields({});
			assert.strictEqual(isFedibirdFieldsChanged(fields, {}), false);
		});
	});

	describe("buildCopiedEmojiExtraFields", () => {
		it("正常系：全項目を引き継ぎ、コピー元のカテゴリはホスト名を外す", () => {
			const out = buildCopiedEmojiExtraFields({
				host: "misskey.io",
				category: "もこチキ <misskey.io>",
				alternateName: "表示名",
				ruby: "よみ",
				relatedLinks: ["https://a.example"],
				copyrightNotice: "©",
				creditText: "MEGAMOJI",
				sourceLicenseText: "PD",
			});
			assert.deepStrictEqual(out, {
				alternateName: "表示名",
				ruby: "よみ",
				relatedLinks: ["https://a.example"],
				copyrightNotice: "©",
				creditText: "MEGAMOJI",
				sourceLicenseText: "PD",
				orgCategory: "もこチキ",
			});
		});
	});

	describe("buildMisskeyLicenseFreeText", () => {
		const empty = {
			alternateName: null,
			ruby: null,
			creator: null,
			copyrightNotice: null,
			creditText: null,
			licenseName: null,
			usageInfo: null,
			relatedLinks: [],
			copyPermission: null,
			description: null,
		};

		it("正常系：Fedibird の format_summary と同じ並びで書く", () => {
			const out = buildMisskeyLicenseFreeText({
				alternateName: "表示名",
				ruby: "よみ",
				creator: "@emtk@mkkey.net",
				copyrightNotice: "©",
				creditText: "MEGAMOJI",
				licenseName: "CC BY 4.0",
				usageInfo: "一声ください",
				relatedLinks: ["https://a.example", "https://b.example"],
				copyPermission: "allow",
				description: "説明",
			});
			assert.strictEqual(
				out,
				"name: 表示名, (よみ), creator: @emtk@mkkey.net, copyrightNotice: ©, creditText: MEGAMOJI, license: CC BY 4.0, usage: 一声ください, links: https://a.example https://b.example, #allow, description: 説明",
			);
		});

		it("正常系：コピー可否が none のときは # を書かない", () => {
			assert.strictEqual(
				buildMisskeyLicenseFreeText({ ...empty, licenseName: "PD", copyPermission: "none" }),
				"license: PD",
			);
		});

		it("正常系：改行は空白に置き換える", () => {
			assert.strictEqual(
				buildMisskeyLicenseFreeText({ ...empty, creditText: "1行目\r\n2行目" }),
				"creditText: 1行目 2行目",
			);
		});

		it("境界値：書く項目が 1 つも無ければ null", () => {
			assert.strictEqual(buildMisskeyLicenseFreeText(empty), null);
		});
	});
});
