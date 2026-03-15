/**
 * @packageDocumentation
 *
 * OpenAPI 用のスキーマ変換と共通スキーマ定義。
 *
 * @remarks
 * - **役割**: 内部 Schema を OpenAPI 3.0 の components/schemas 形式に変換する。
 * - `convertSchemaToOpenApiSchema` で refs や required を付与。`schemas` は Error 等の共通定義を保持。
 *
 * @see {@link gen-spec} 仕様生成で利用
 * @internal
 */
import type { Schema } from "@/misc/schema.js";
import { refs } from "@/misc/schema.js";

export function convertSchemaToOpenApiSchema(schema: Schema) {
	const res: any = schema;

	if (schema.type === "object" && schema.properties) {
		res.required = Object.entries(schema.properties)
			.filter(([k, v]) => !v.optional)
			.map(([k]) => k);

		for (const k of Object.keys(schema.properties)) {
			res.properties[k] = convertSchemaToOpenApiSchema(schema.properties[k]);
		}
	}

	if (schema.type === "array" && schema.items) {
		res.items = convertSchemaToOpenApiSchema(schema.items);
	}

	if (schema.anyOf) res.anyOf = schema.anyOf.map(convertSchemaToOpenApiSchema);
	if (schema.oneOf) res.oneOf = schema.oneOf.map(convertSchemaToOpenApiSchema);
	if (schema.allOf) res.allOf = schema.allOf.map(convertSchemaToOpenApiSchema);

	if (schema.ref) {
		res.$ref = `#/components/schemas/${schema.ref}`;
	}

	return res;
}

export const schemas = {
	Error: {
		type: "object",
		properties: {
			error: {
				type: "object",
				description: "エラーオブジェクト。",
				properties: {
					code: {
						type: "string",
						description: "エラーコード。エンドポイント内で一意。",
					},
					message: {
						type: "string",
						description: "エラーメッセージ。",
					},
					id: {
						type: "string",
						format: "uuid",
						description: "エラー ID。この ID は固定。",
					},
				},
				required: ["code", "id", "message"],
			},
		},
		required: ["error"],
	},

	...Object.fromEntries(
		Object.entries(refs).map(([key, schema]) => [
			key,
			convertSchemaToOpenApiSchema(schema),
		]),
	),
};
