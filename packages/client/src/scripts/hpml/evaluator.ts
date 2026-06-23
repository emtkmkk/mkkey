import autobind from "autobind-decorator";
import { HpmlError, HpmlScope } from ".";
import type { Fn, PageVar, envVarsDef } from ".";
import { version } from "@/config";
import type { Interpreter } from "@syuilo/aiscript";
import { createAiScriptEnv } from "../aiscript/api";
import type { AiscriptRuntime } from "../aiscript/runtime";
import { collectPageVars } from "../collect-page-vars";
import { initHpmlLib, initAiLib } from "./lib";
import * as os from "@/os";
import { markRaw, ref, Ref, unref } from "vue";
import type { Expr, Variable } from "./expr";
import { isLiteralValue } from "./expr";

/**
 * HPML（ブロックモード）評価器。
 *
 * @remarks
 * AiScript は {@link initAiscript} でバージョン別ランタイムを注入してから実行する。
 *
 * @public
 */
export class Hpml {
	private variables: Variable[];
	private pageVars: PageVar[];
	private envVars: Record<keyof typeof envVarsDef, any>;
	public aiscript?: Interpreter;
	/** {@link initAiscript} で注入した utils（aiScriptVar 評価用） */
	private runtimeUtils?: AiscriptRuntime["utils"];
	/** {@link initAiscript} で注入した values（コールバック実行用） */
	private runtimeValues?: AiscriptRuntime["values"];
	public pageVarUpdatedCallback?: unknown;
	public canvases: Record<string, HTMLCanvasElement> = {};
	public vars: Ref<Record<string, any>> = ref({});
	public page: Record<string, any>;

	private opts: {
		randomSeed: string;
		visitor?: any;
		url?: string;
		enableAiScript: boolean;
	};

	constructor(page: Hpml["page"], opts: Hpml["opts"]) {
		this.page = page;
		this.variables = this.page.variables;
		this.pageVars = collectPageVars(this.page.content);
		this.opts = opts;

		// NOTE: AiScript インタプリタは script 注釈に応じた RT を page.vue 側で
		// loadAiscriptRuntime した後、initAiscript で初期化する。

		const date = new Date();

		this.envVars = {
			AI: "kawaii",
			VERSION: version,
			URL: this.page
				? `${opts.url}/@${this.page.user.username}/pages/${this.page.name}`
				: "",
			LOGIN: opts.visitor != null,
			NAME: opts.visitor ? opts.visitor.name || opts.visitor.username : "",
			USERNAME: opts.visitor ? opts.visitor.username : "",
			USERID: opts.visitor ? opts.visitor.id : "",
			NOTES_COUNT: opts.visitor ? opts.visitor.notesCount : 0,
			FOLLOWERS_COUNT: opts.visitor ? opts.visitor.followersCount : 0,
			FOLLOWING_COUNT: opts.visitor ? opts.visitor.followingCount : 0,
			IS_CAT: opts.visitor ? opts.visitor.isCat : false,
			SEED: opts.randomSeed ? opts.randomSeed : "",
			YMD: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
			AISCRIPT_DISABLED: !this.opts.enableAiScript,
			NULL: null,
		};

		this.eval();
	}

	/**
	 * スクリプト注釈に応じた AiScript ランタイムでインタプリタを初期化する。
	 *
	 * @param runtime - {@link loadAiscriptRuntime} の戻り値
	 * @remarks enableAiScript が false のときは何もしない
	 * @public
	 */
	@autobind
	public initAiscript(runtime: AiscriptRuntime): void {
		if (!this.opts.enableAiScript) return;

		this.runtimeUtils = runtime.utils;
		this.runtimeValues = runtime.values;
		this.aiscript = markRaw(
			new runtime.Interpreter(
				{
					...createAiScriptEnv(
						{
							storageKey: `pages:${this.page.id}`,
						},
						runtime,
					),
					...initAiLib(this, runtime),
				},
				{
					in: (q) => {
						return new Promise((ok) => {
							os.inputText({
								title: q,
							}).then(({ canceled, result: a }) => {
								ok(a);
							});
						});
					},
					out: (value) => {
						console.log(value);
					},
					log: (_type, _params) => {},
				},
			),
		);

		this.aiscript.scope.opts.onUpdated = (_name, _value) => {
			this.eval();
		};
	}

	@autobind
	public eval() {
		try {
			this.vars.value = this.evaluateVars();
		} catch (err) {
			console.error(err);
			//this.onError(e);
		}
	}

	@autobind
	public interpolate(str: string) {
		if (str == null) return null;
		return str.replace(/{(.+?)}/g, (match) => {
			const v = unref(this.vars)[match.slice(1, -1).trim()];
			return v == null ? "NULL" : v.toString();
		});
	}

	@autobind
	public callAiScript(fn: string) {
		try {
			if (this.aiscript) this.aiscript.execFn(this.aiscript.scope.get(fn), []);
		} catch (err) {
			console.error(err);
		}
	}

	@autobind
	public registerCanvas(id: string, canvas: any) {
		this.canvases[id] = canvas;
	}

	@autobind
	public updatePageVar(name: string, value: any) {
		const pageVar = this.pageVars.find((v) => v.name === name);
		if (pageVar !== undefined) {
			pageVar.value = value;
			if (this.pageVarUpdatedCallback) {
				if (this.aiscript && this.runtimeValues && this.runtimeUtils)
					this.aiscript.execFn(this.pageVarUpdatedCallback, [
						this.runtimeValues.STR(name),
						this.runtimeUtils.jsToVal(value),
					]);
			}
		} else {
			throw new HpmlError(`No such page var '${name}'`);
		}
	}

	@autobind
	public updateRandomSeed(seed: string) {
		this.opts.randomSeed = seed;
		this.envVars.SEED = seed;
	}

	@autobind
	private _interpolateScope(str: string, scope: HpmlScope) {
		return str.replace(/{(.+?)}/g, (match) => {
			const v = scope.getState(match.slice(1, -1).trim());
			return v == null ? "NULL" : v.toString();
		});
	}

	@autobind
	public evaluateVars(): Record<string, any> {
		const values: Record<string, any> = {};

		for (const [k, v] of Object.entries(this.envVars)) {
			values[k] = v;
		}

		for (const v of this.pageVars) {
			values[v.name] = v.value;
		}

		for (const v of this.variables) {
			values[v.name] = this.evaluate(v, new HpmlScope([values]));
		}

		return values;
	}

	@autobind
	private evaluate(expr: Expr, scope: HpmlScope): any {
		if (isLiteralValue(expr)) {
			if (expr.type === null) {
				return null;
			}

			if (expr.type === "number") {
				return parseInt(expr.value as any, 10);
			}

			if (expr.type === "text" || expr.type === "multiLineText") {
				return this._interpolateScope(expr.value || "", scope);
			}

			if (expr.type === "textList") {
				return this._interpolateScope(expr.value || "", scope)
					.trim()
					.split("\n");
			}

			if (expr.type === "ref") {
				return scope.getState(expr.value);
			}

			if (expr.type === "aiScriptVar") {
				if (this.aiscript && this.runtimeUtils) {
					try {
						return this.runtimeUtils.valToJs(
							this.aiscript.scope.get(expr.value),
						);
					} catch (err) {
						console.error(err);
						return null;
					}
				} else {
					return null;
				}
			}

			// Define user function
			if (expr.type === "fn") {
				return {
					slots: expr.value.slots.map((x) => x.name),
					exec: (slotArg: Record<string, any>) => {
						return this.evaluate(
							expr.value.expression,
							scope.createChildScope(slotArg, expr.id),
						);
					},
				} as Fn;
			}
			return;
		}

		// Call user function
		if (expr.type.startsWith("fn:")) {
			const fnName = expr.type.split(":")[1];
			const fn = scope.getState(fnName);
			const args = {} as Record<string, any>;
			for (let i = 0; i < fn.slots.length; i++) {
				const name = fn.slots[i];
				args[name] = this.evaluate(expr.args[i], scope);
			}
			return fn.exec(args);
		}

		if (expr.args === undefined) return null;

		const funcs = initHpmlLib(
			expr,
			scope,
			this.opts.randomSeed,
			this.opts.visitor,
		);

		// Call function
		const fnName = expr.type;
		const fn = (funcs as any)[fnName];
		if (fn == null) {
			throw new HpmlError(`No such function '${fnName}'`);
		} else {
			return fn(...expr.args.map((x) => this.evaluate(x, scope)));
		}
	}
}
