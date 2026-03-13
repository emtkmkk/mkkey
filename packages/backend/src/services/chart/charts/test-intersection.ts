/**
 * @packageDocumentation
 *
 * テスト用積集合チャートの集計・取得。
 *
 * @remarks
 * - **役割**: テスト用の Chart 実装。core の Chart を継承し、積集合集計の動作確認に使う。
 *
 * @see {@link chart/core} Chart 基底
 * @internal
 */
import type { KVs } from "../core.js";
import Chart from "../core.js";
import { name, schema } from "./entities/test-intersection.js";

/**
 * For testing
 */

export default class TestIntersectionChart extends Chart<typeof schema> {
	constructor() {
		super(name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async addA(key: string): Promise<void> {
		await this.commit({
			a: [key],
		});
	}

	public async addB(key: string): Promise<void> {
		await this.commit({
			b: [key],
		});
	}
}
