/**
 * @packageDocumentation
 *
 * AiScript 0.11.x（旧 API）を 0.19+ 互換の {@link AiscriptRuntime} 形状に変換する。
 *
 * @remarks
 * - 0.11 は `AiScript` クラスと `parse()` 関数を使用する
 * - Play / プラグイン共通コードから透過的に利用するためのアダプタ
 *
 * @internal
 */
import type { AiscriptRuntime } from "./runtime";

/** 0.11.x パッケージの import 結果 */
export type AncientAiscriptModule = {
	AiScript: new (
		vars: Record<string, unknown>,
		opts?: {
			in?: (q: string) => Promise<string>;
			out?: (value: unknown) => void;
			log?: (type: string, params: Record<string, unknown>) => void;
		},
	) => {
		exec: (script?: unknown[]) => Promise<void>;
		execFn: (fn: unknown, args: unknown[]) => Promise<unknown>;
		abort: () => void;
	};
	parse: (src: string) => unknown[];
	utils: AiscriptRuntime["utils"];
	values: AiscriptRuntime["values"];
};

/**
 * 0.11.x モジュールを {@link AiscriptRuntime} に適合させる。
 *
 * @param mod - `@syuilo/aiscript-0-11-1` の dynamic import 結果
 * @returns 統一 RT
 * @internal
 */
export function adaptAncientRuntime(
	mod: AncientAiscriptModule,
): AiscriptRuntime {
	const { AiScript, parse, utils, values } = mod;

	class Parser {
		parse(src: string): unknown[] {
			return parse(src) as unknown[];
		}
	}

	class Interpreter {
		private ai: InstanceType<typeof AiScript>;

		constructor(
			vars: Record<string, unknown>,
			opts?: {
				in?: (q: string) => Promise<string>;
				out?: (value: unknown) => void;
				log?: (type: string, params: Record<string, unknown>) => void;
			},
		) {
			this.ai = new AiScript(vars, {
				in: opts?.in,
				out: opts?.out,
				log: opts?.log,
			});
		}

		exec(ast: unknown): Promise<void> {
			return this.ai.exec(ast as unknown[]);
		}

		execFn(fn: unknown, args: unknown[]): Promise<unknown> {
			return this.ai.execFn(fn as never, args as never);
		}

		abort(): void {
			this.ai.abort();
		}
	}

	(
		Interpreter as unknown as {
			collectMetadata: typeof AiScript.collectMetadata;
		}
	).collectMetadata = AiScript.collectMetadata;

	return {
		Interpreter: Interpreter as unknown as AiscriptRuntime["Interpreter"],
		Parser: Parser as unknown as AiscriptRuntime["Parser"],
		utils,
		values,
	};
}
