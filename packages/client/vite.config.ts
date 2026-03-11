/**
 * @packageDocumentation
 *
 * クライアントビルド用のVite設定と、ビルド時に埋め込むバージョン文字列の生成を行うモジュール。
 *
 * @remarks
 * NOTE: バージョン文字列は `yyyy.m.d+<hash>` 形式で生成されます（ゼロ埋め無し）。
 * NOTE: git が利用できない環境ではビルド日時から同形式のバージョンを生成します。
 *
 * @public
 */
import * as fs from "fs";
import { execSync } from "node:child_process";
import pluginVue from "@vitejs/plugin-vue";
import { defineConfig, type PluginOption } from "vite";

import locales from "../../locales";
import pluginJson5 from "./vite.json5";
import viteCompression from "vite-plugin-compression";

const extensions = [
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".json",
	".json5",
	".svg",
	".sass",
	".scss",
	".css",
	".vue",
];

/**
 * 最終コミット日時またはビルド日時からバージョン文字列を生成する。
 *
 * @remarks
 * - 形式は `yyyy.m.d+<hash>`（月と日はゼロ埋めしない）となります。
 * - git から取得する日付はゼロ埋めされた `yyyy.mm.dd` 形式のため、数値変換してから整形し直しています。
 *
 * @returns `yyyy.m.d+<hash>` 形式のバージョン文字列
 *
 * @public
 */
const buildVersion = () => {
	let date: string;
	try {
		// 最終コミット日を yyyy.mm.dd 形式で取得（後でゼロ埋めを外す）
		const out = execSync(
			"git log -1 --format=%cd --date=format:'%Y.%m.%d'",
			{ encoding: "utf8" },
		).trim();
		if (out) {
			const [yRaw, mRaw, dRaw] = out.split(".");
			const y = Number(yRaw);
			const m = Number(mRaw);
			const d = Number(dRaw);
			date = `${y}.${m}.${d}`;
		} else {
			date = "";
		}
	} catch {
		// git が使えない環境ではビルド日でフォールバック
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth() + 1;
		const d = now.getDate();
		date = `${y}.${m}.${d}`;
	}
	const hash = (process.env.COMMIT_HASH || "dev").slice(0, 6);
	return `${date}+${hash}`;
};

const version = buildVersion();
fs.mkdirSync(__dirname + "/../../built", { recursive: true });
fs.writeFileSync(
	__dirname + "/../../built/meta.json",
	JSON.stringify({ version }),
	"utf-8",
);

export default defineConfig({
		base: "/assets/",

		plugins: [
			pluginVue({
				reactivityTransform: true,
			}),
			pluginJson5(),
			viteCompression({
				algorithm: "brotliCompress",
			}),
		] as PluginOption[],

		resolve: {
			extensions,
			alias: {
				"@/": __dirname + "/src/",
				"/client-assets/": __dirname + "/assets/",
				"/static-assets/": __dirname + "/../backend/assets/",
			},
		},

		define: {
			_VERSION_: JSON.stringify(version),
			_LANGS_: JSON.stringify(
				Object.entries(locales).map(([k, v]) => [k, v._lang_]),
			),
			_ENV_: JSON.stringify(process.env.NODE_ENV),
			_DEV_: process.env.NODE_ENV !== "production",
			_PERF_PREFIX_: JSON.stringify("Misskey:"),
			_DATA_TRANSFER_DRIVE_FILE_: JSON.stringify("mk_drive_file"),
			_DATA_TRANSFER_DRIVE_FOLDER_: JSON.stringify("mk_drive_folder"),
			_DATA_TRANSFER_DECK_COLUMN_: JSON.stringify("mk_deck_column"),
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
		},

		build: {
			target: ["chrome87", "firefox78", "safari14", "es2017"],
			manifest: "manifest.json",
			rollupOptions: {
				input: {
					app: "./src/init.ts",
				},
				output: {
					manualChunks: {
						vue: ["vue"],
					},
				},
			},
			cssCodeSplit: true,
			assetsInlineLimit: 0,
			outDir: __dirname + "/../../built/_client_dist_",
			assetsDir: ".",
			emptyOutDir: false,
			sourcemap: process.env.NODE_ENV === "development",
			reportCompressedSize: false,
			commonjsOptions: {
				include: [/calckey-js/, /node_modules/],
			},
		},
	});
