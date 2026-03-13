/**
 * @packageDocumentation
 *
 * Elasticsearch クライアントの初期化とインデックス設定。検索用。
 *
 * @remarks
 * - **役割**: ノート検索・ユーザー検索で Elasticsearch に接続し、インデックス・クエリを提供する。
 *
 * @see {@link services/search} 検索サービス
 * @internal
 */
import * as elasticsearch from "@elastic/elasticsearch";
import config from "@/config/index.js";

const index = {
	settings: {
		analysis: {
			analyzer: {
				ngram: {
					tokenizer: "ngram",
				},
			},
		},
	},
	mappings: {
		properties: {
			text: {
				type: "text",
				index: true,
				analyzer: "ngram",
			},
			userId: {
				type: "keyword",
				index: true,
			},
			userHost: {
				type: "keyword",
				index: true,
			},
		},
	},
};

// Elasticsearch 接続の初期化
const client = config.elasticsearch
	? new elasticsearch.Client({
			node: `${config.elasticsearch.ssl ? "https://" : "http://"}${
				config.elasticsearch.host
			}:${config.elasticsearch.port}`,
			auth:
				config.elasticsearch.user && config.elasticsearch.pass
					? {
							username: config.elasticsearch.user,
							password: config.elasticsearch.pass,
					  }
					: undefined,
			pingTimeout: 30000,
	  })
	: null;

if (client) {
	client.indices
		.exists({
			index: config.elasticsearch.index || "misskey_note",
		})
		.then((exist) => {
			if (!exist.body) {
				client.indices.create({
					index: config.elasticsearch.index || "misskey_note",
					body: index,
				});
			}
		});
}

export default client;
