/**
 * @packageDocumentation
 *
 * 設定ファイル（YAML）とビルドメタ情報を読み込み、Config を組み立てる。
 *
 * @remarks
 * - **役割**: 起動時に .config/default.yml（または test.yml）を読み、環境変数やビルドメタをマージして Config を返す。
 *
 * @see {@link env} 環境変数
 * @internal
 */

import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as yaml from "js-yaml";
import type { Source, Mixin } from "./types.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/** 設定ディレクトリのパス */
const dir = `${_dirname}/../../../../.config`;

/** 読み込む設定ファイルのパス（NODE_ENV=test のときは test.yml、それ以外は default.yml） */
const path =
	process.env.NODE_ENV === "test" ? `${dir}/test.yml` : `${dir}/default.yml`;

/**
 * 設定ファイルとビルドメタを読み込み、Config を返す。
 * @returns マージ済みの設定オブジェクト
 * @internal
 */
export default function load() {
	const meta = JSON.parse(
		fs.readFileSync(`${_dirname}/../../../../built/meta.json`, "utf-8"),
	);
	const clientManifest = JSON.parse(
		fs.readFileSync(
			`${_dirname}/../../../../built/_client_dist_/manifest.json`,
			"utf-8",
		),
	);
	const config = yaml.load(fs.readFileSync(path, "utf-8")) as Source;

	const mixin = {} as Mixin;

	const url = tryCreateUrl(config.url);

	config.url = url.origin;

	config.port = config.port || parseInt(process.env.PORT || "", 10);

	mixin.version = meta.version;
	mixin.langs = Array.isArray(meta.langs) ? meta.langs : ["ja-JP"];
	mixin.host = url.host;
	mixin.hostname = url.hostname;
	mixin.scheme = url.protocol.replace(/:$/, "");
	mixin.wsScheme = mixin.scheme.replace("http", "ws");
	mixin.wsUrl = `${mixin.wsScheme}://${mixin.host}`;
	mixin.apiUrl = `${mixin.scheme}://${mixin.host}/api`;
	mixin.authUrl = `${mixin.scheme}://${mixin.host}/auth`;
	mixin.driveUrl = `${mixin.scheme}://${mixin.host}/files`;
	mixin.userAgent = `Cluckey/${mixin.version} (${config.url})`;
	mixin.clientEntry = clientManifest["src/init.ts"];

	if (!config.redis.prefix) config.redis.prefix = mixin.host;

	if (!config.clusterLimits) {
		config.clusterLimits = {
			web:
				config.clusterLimit && config.clusterLimit > 1
					? config.clusterLimit - 1
					: 1,
			queue: 1,
		};
	} else {
		config.clusterLimits = {
			web:
				config.clusterLimit && config.clusterLimit > 1
					? config.clusterLimit - 1
					: 1,
			queue: 1,
			...config.clusterLimits,
		};

		if (config.clusterLimits.web! < 1 || config.clusterLimits.queue! < 1) {
			throw new Error("Invalid cluster limits");
		}
	}

	return Object.assign(config, mixin);
}

/**
 * 文字列を URL にパースする。無効な場合はエラーを投げる。
 * @param url - パースする URL 文字列
 * @returns パース済み URL オブジェクト
 * @throws 無効な URL の場合
 * @internal
 */
function tryCreateUrl(url: string) {
	try {
		return new URL(url);
	} catch (e) {
		throw new Error(`url="${url}" is not a valid URL.`);
	}
}
