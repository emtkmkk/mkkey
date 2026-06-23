/**

 * @packageDocumentation

 *

 * Play モード（AiScript Ui:）スクリプトの実行ヘルパー。

 *

 * @public

 */

import { markRaw, ref, shallowRef } from "vue";

import type { Ref, ShallowRef } from "vue";

import type { Interpreter } from "@syuilo/aiscript";

import { createAiScriptEnv } from "./api";

import {
	loadAiscriptRuntime,
	prepareScriptSource,
	resolveAiscriptKind,
	supportsUiLib,
} from "./runtime";

import { registerAsUiLib, type AsUiComponent, type AsUiRoot } from "./ui";

import * as os from "@/os";



/** Play スクリプト実行コンテキスト */

export type PlayScriptContext = {

	components: Ref<Ref<AsUiComponent>[]>;

	root: Ref<AsUiRoot | undefined>;

	interpreter: ShallowRef<Interpreter | null>;

};



/**

 * Play スクリプト実行用のコンテキストを生成する。

 *

 * @returns コンポーネント配列・ルート・インタプリタ参照

 * @public

 */

export function createPlayScriptContext(): PlayScriptContext {

	return {

		components: ref([]),

		root: ref(),

		interpreter: shallowRef(null),

	};

}



/** runPlayScript のオプション */

export type RunPlayScriptOptions = {

	storageKey: string;

	thisId: string;

	thisUrl: string;

	token?: string | null;

	/** print / `<:` 出力（Scratchpad 等） */

	out?: (value: { type: string; value?: unknown }) => void;

	/** 評価結果ログ */

	log?: (type: string, params: Record<string, unknown>) => void;

};



/**

 * Play スクリプトを実行する。

 *

 * @param script - AiScript ソース

 * @param ctx - 実行コンテキスト

 * @param opts - ストレージキー・THIS_* 定数・トークン

 * @throws パースエラー・実行エラー

 * @public

 */

export async function runPlayScript(

	script: string,

	ctx: PlayScriptContext,

	opts: RunPlayScriptOptions,

): Promise<void> {

	if (ctx.interpreter.value) ctx.interpreter.value.abort();



	ctx.components.value = [];

	ctx.root.value = undefined;



	const runtime = await loadAiscriptRuntime(script);
	const kind = resolveAiscriptKind(script);
	const source = prepareScriptSource(script, kind);

	const componentRefs: Ref<AsUiComponent>[] = [];

	const uiLib = supportsUiLib(script)

		? registerAsUiLib(

				componentRefs,

				(r) => {

					ctx.root.value = r.value;

				},

				runtime,

			)

		: {};



	const aiscript = markRaw(

		new runtime.Interpreter(

			{

				...createAiScriptEnv(

					{

						storageKey: opts.storageKey,

						token: opts.token,

					},

					runtime,

				),

				...uiLib,

				THIS_ID: runtime.values.STR(opts.thisId),

				THIS_URL: runtime.values.STR(opts.thisUrl),

			},

			{

				in: (q) => {

					return new Promise((ok) => {

						os.inputText({ title: q }).then(({ canceled, result: a }) => {

							ok(a);

						});

					});

				},

				out: opts.out ?? (() => {}),

				log: opts.log ?? (() => {}),

			},

		),

	);



	ctx.interpreter.value = aiscript as Interpreter;

	ctx.components.value = componentRefs;



	const parser = new runtime.Parser();

	const ast = parser.parse(source);

	await aiscript.exec(ast);

}



/**

 * 実行中の Play スクリプトを中断する。

 *

 * @param ctx - 実行コンテキスト

 * @public

 */

export function abortPlayScript(ctx: PlayScriptContext): void {

	if (ctx.interpreter.value) ctx.interpreter.value.abort();

}
