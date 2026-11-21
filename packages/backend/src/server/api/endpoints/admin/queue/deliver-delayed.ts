/**
 * @packageDocumentation
 *
 * deliver キューで遅延中（再送待ち）のジョブを、配送先ホストごとに数えて多い順に返す API。
 *
 * @internal
 */
import { deliverQueue } from "@/queue/queues.js";
import { URL } from "node:url";
import define from "../../../define.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:queue",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "array",
			optional: false,
			nullable: false,
			items: {
				anyOf: [
					{
						type: "string",
					},
					{
						type: "number",
					},
				],
			},
		},
		example: [["example.com", 12]],
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const jobs = await deliverQueue.getJobs(["delayed"]);

	// OPTIMIZE で直した: 以前は配列を線形探索していて、件数 × ホスト数の計算量だった
	const counts = new Map<string, number>();
	for (const job of jobs) {
		const host = new URL(job.data.to).host;
		counts.set(host, (counts.get(host) ?? 0) + 1);
	}

	return [...counts].sort((a, b) => b[1] - a[1]);
});
