/**
 * @packageDocumentation
 *
 * Misskey Play 互換の AiScript Ui: API（`registerAsUiLib`）を提供する。
 *
 * @remarks
 * - `Ui:render` / `Ui:C:*` で Vue コンポーネントツリーを構築する
 * - {@link MkAsUi} が描画を担当する
 *
 * @see {@link registerAsUiLib}
 * @public
 */
import { utils, values } from "@syuilo/aiscript";
import type { values as ValuesNS } from "@syuilo/aiscript";
import type { AiscriptRuntime } from "./runtime";
import { ref } from "vue";
import type { Ref } from "vue";
import { v4 as uuid } from "uuid";
import * as misskey from "calckey-js";
import { assertStringAndIsIn } from "./common";

const ALIGNS = ["left", "center", "right"] as const;
const FONTS = ["serif", "sans-serif", "monospace"] as const;
const BORDER_STYLES = [
	"hidden",
	"dotted",
	"dashed",
	"solid",
	"double",
	"groove",
	"ridge",
	"inset",
	"outset",
] as const;

type Align = (typeof ALIGNS)[number];
type Font = (typeof FONTS)[number];
type BorderStyle = (typeof BORDER_STYLES)[number];

/** Ui コンポーネント共通フィールド */
export type AsUiComponentBase = {
	id: string;
	hidden?: boolean;
	children?: AsUiComponent["id"][];
};

/** ルートコンポーネント */
export type AsUiRoot = AsUiComponentBase & {
	type: "root";
};

/** コンテナ */
export type AsUiContainer = AsUiComponentBase & {
	type: "container";
	align?: Align;
	bgColor?: string;
	fgColor?: string;
	font?: Font;
	borderWidth?: number;
	borderColor?: string;
	borderStyle?: BorderStyle;
	borderRadius?: number;
	padding?: number;
	rounded?: boolean;
	hidden?: boolean;
};

/** テキスト */
export type AsUiText = AsUiComponentBase & {
	type: "text";
	text?: string;
	size?: number;
	bold?: boolean;
	color?: string;
	font?: Font;
};

/** MFM テキスト */
export type AsUiMfm = AsUiComponentBase & {
	type: "mfm";
	text?: string;
	size?: number;
	bold?: boolean;
	color?: string;
	font?: Font;
	onClickEv?: (evId: string) => Promise<void>;
};

/** ボタン */
export type AsUiButton = AsUiComponentBase & {
	type: "button";
	text?: string;
	onClick?: () => Promise<void>;
	primary?: boolean;
	rounded?: boolean;
	disabled?: boolean;
};

/** ボタン群 */
export type AsUiButtons = AsUiComponentBase & {
	type: "buttons";
	buttons?: AsUiButton[];
};

/** スイッチ */
export type AsUiSwitch = AsUiComponentBase & {
	type: "switch";
	onChange?: (v: boolean) => Promise<void>;
	default?: boolean;
	label?: string;
	caption?: string;
};

/** テキストエリア */
export type AsUiTextarea = AsUiComponentBase & {
	type: "textarea";
	onInput?: (v: string) => Promise<void>;
	default?: string;
	label?: string;
	caption?: string;
};

/** テキスト入力 */
export type AsUiTextInput = AsUiComponentBase & {
	type: "textInput";
	onInput?: (v: string) => Promise<void>;
	default?: string;
	label?: string;
	caption?: string;
};

/** 数値入力 */
export type AsUiNumberInput = AsUiComponentBase & {
	type: "numberInput";
	onInput?: (v: number) => Promise<void>;
	default?: number;
	label?: string;
	caption?: string;
};

/** セレクト */
export type AsUiSelect = AsUiComponentBase & {
	type: "select";
	items?: {
		text: string;
		value: string;
	}[];
	onChange?: (v: string) => Promise<void>;
	default?: string;
	label?: string;
	caption?: string;
};

/** フォルダ（アコーディオン） */
export type AsUiFolder = AsUiComponentBase & {
	type: "folder";
	title?: string;
	opened?: boolean;
};

type PostFormPropsForAsUi = {
	text: string;
	cw?: string;
	visibility?: (typeof misskey.noteVisibilities)[number];
	localOnly?: boolean;
};

/** 投稿フォームボタン */
export type AsUiPostFormButton = AsUiComponentBase & {
	type: "postFormButton";
	text?: string;
	primary?: boolean;
	rounded?: boolean;
	form?: PostFormPropsForAsUi;
};

/** 投稿フォーム */
export type AsUiPostForm = AsUiComponentBase & {
	type: "postForm";
	form?: PostFormPropsForAsUi;
};

/** Ui コンポーネントの和型 */
export type AsUiComponent =
	| AsUiRoot
	| AsUiContainer
	| AsUiText
	| AsUiMfm
	| AsUiButton
	| AsUiButtons
	| AsUiSwitch
	| AsUiTextarea
	| AsUiTextInput
	| AsUiNumberInput
	| AsUiSelect
	| AsUiFolder
	| AsUiPostFormButton
	| AsUiPostForm;

type Options<T extends AsUiComponent> = T extends AsUiButtons
	? Omit<T, "id" | "type" | "buttons"> & { buttons?: Options<AsUiButton>[] }
	: Omit<T, "id" | "type">;

type CallFn = (
	fn: ValuesNS.VFn,
	args: ValuesNS.Value[],
) => Promise<ValuesNS.Value>;

/** コンポーネント ID を生成する */
function genId(): string {
	return uuid();
}

function getRootOptions(def: ValuesNS.Value | undefined): Options<AsUiRoot> {
	utils.assertObject(def);

	const children = def.value.get("children");
	utils.assertArray(children);

	return {
		children: children.value.map((v) => {
			utils.assertObject(v);
			const id = v.value.get("id");
			utils.assertString(id);
			return id.value;
		}),
	};
}

function getContainerOptions(
	def: ValuesNS.Value | undefined,
): Options<AsUiContainer> {
	utils.assertObject(def);

	const children = def.value.get("children");
	if (children) utils.assertArray(children);
	const align = def.value.get("align");
	if (align) assertStringAndIsIn(align, ALIGNS);
	const bgColor = def.value.get("bgColor");
	if (bgColor) utils.assertString(bgColor);
	const fgColor = def.value.get("fgColor");
	if (fgColor) utils.assertString(fgColor);
	const font = def.value.get("font");
	if (font) assertStringAndIsIn(font, FONTS);
	const borderWidth = def.value.get("borderWidth");
	if (borderWidth) utils.assertNumber(borderWidth);
	const borderColor = def.value.get("borderColor");
	if (borderColor) utils.assertString(borderColor);
	const borderStyle = def.value.get("borderStyle");
	if (borderStyle) assertStringAndIsIn(borderStyle, BORDER_STYLES);
	const borderRadius = def.value.get("borderRadius");
	if (borderRadius) utils.assertNumber(borderRadius);
	const padding = def.value.get("padding");
	if (padding) utils.assertNumber(padding);
	const rounded = def.value.get("rounded");
	if (rounded) utils.assertBoolean(rounded);
	const hidden = def.value.get("hidden");
	if (hidden) utils.assertBoolean(hidden);

	return {
		children: children
			? children.value.map((v) => {
					utils.assertObject(v);
					const id = v.value.get("id");
					utils.assertString(id);
					return id.value;
				})
			: [],
		align: align?.value as Align | undefined,
		fgColor: fgColor?.value,
		bgColor: bgColor?.value,
		font: font?.value as Font | undefined,
		borderWidth: borderWidth?.value,
		borderColor: borderColor?.value,
		borderStyle: borderStyle?.value as BorderStyle | undefined,
		borderRadius: borderRadius?.value,
		padding: padding?.value,
		rounded: rounded?.value,
		hidden: hidden?.value,
	};
}

function getTextOptions(def: ValuesNS.Value | undefined): Options<AsUiText> {
	utils.assertObject(def);

	const text = def.value.get("text");
	if (text) utils.assertString(text);
	const size = def.value.get("size");
	if (size) utils.assertNumber(size);
	const bold = def.value.get("bold");
	if (bold) utils.assertBoolean(bold);
	const color = def.value.get("color");
	if (color) utils.assertString(color);
	const font = def.value.get("font");
	if (font) assertStringAndIsIn(font, FONTS);

	return {
		text: text?.value,
		size: size?.value,
		bold: bold?.value,
		color: color?.value,
		font: font?.value as Font | undefined,
	};
}

function getMfmOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiMfm> {
	utils.assertObject(def);

	const text = def.value.get("text");
	if (text) utils.assertString(text);
	const size = def.value.get("size");
	if (size) utils.assertNumber(size);
	const bold = def.value.get("bold");
	if (bold) utils.assertBoolean(bold);
	const color = def.value.get("color");
	if (color) utils.assertString(color);
	const font = def.value.get("font");
	if (font) assertStringAndIsIn(font, FONTS);
	const onClickEv = def.value.get("onClickEv");
	if (onClickEv) utils.assertFunction(onClickEv);

	return {
		text: text?.value,
		size: size?.value,
		bold: bold?.value,
		color: color?.value,
		font: font?.value as Font | undefined,
		onClickEv: async (evId: string) => {
			if (onClickEv) await call(onClickEv, [values.STR(evId)]);
		},
	};
}

function getTextInputOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiTextInput> {
	utils.assertObject(def);

	const onInput = def.value.get("onInput");
	if (onInput) utils.assertFunction(onInput);
	const defaultValue = def.value.get("default");
	if (defaultValue) utils.assertString(defaultValue);
	const label = def.value.get("label");
	if (label) utils.assertString(label);
	const caption = def.value.get("caption");
	if (caption) utils.assertString(caption);

	return {
		onInput: async (v) => {
			if (onInput) await call(onInput, [utils.jsToVal(v)]);
		},
		default: defaultValue?.value,
		label: label?.value,
		caption: caption?.value,
	};
}

function getTextareaOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiTextarea> {
	utils.assertObject(def);

	const onInput = def.value.get("onInput");
	if (onInput) utils.assertFunction(onInput);
	const defaultValue = def.value.get("default");
	if (defaultValue) utils.assertString(defaultValue);
	const label = def.value.get("label");
	if (label) utils.assertString(label);
	const caption = def.value.get("caption");
	if (caption) utils.assertString(caption);

	return {
		onInput: async (v) => {
			if (onInput) await call(onInput, [utils.jsToVal(v)]);
		},
		default: defaultValue?.value,
		label: label?.value,
		caption: caption?.value,
	};
}

function getNumberInputOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiNumberInput> {
	utils.assertObject(def);

	const onInput = def.value.get("onInput");
	if (onInput) utils.assertFunction(onInput);
	const defaultValue = def.value.get("default");
	if (defaultValue) utils.assertNumber(defaultValue);
	const label = def.value.get("label");
	if (label) utils.assertString(label);
	const caption = def.value.get("caption");
	if (caption) utils.assertString(caption);

	return {
		onInput: async (v) => {
			if (onInput) await call(onInput, [utils.jsToVal(v)]);
		},
		default: defaultValue?.value,
		label: label?.value,
		caption: caption?.value,
	};
}

function getButtonOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiButton> {
	utils.assertObject(def);

	const text = def.value.get("text");
	if (text) utils.assertString(text);
	const onClick = def.value.get("onClick");
	if (onClick) utils.assertFunction(onClick);
	const primary = def.value.get("primary");
	if (primary) utils.assertBoolean(primary);
	const rounded = def.value.get("rounded");
	if (rounded) utils.assertBoolean(rounded);
	const disabled = def.value.get("disabled");
	if (disabled) utils.assertBoolean(disabled);

	return {
		text: text?.value,
		onClick: async () => {
			if (onClick) await call(onClick, []);
		},
		primary: primary?.value,
		rounded: rounded?.value,
		disabled: disabled?.value,
	};
}

function getButtonsOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiButtons> {
	utils.assertObject(def);

	const buttons = def.value.get("buttons");
	if (buttons) utils.assertArray(buttons);

	return {
		buttons: buttons
			? buttons.value.map((button) => {
					utils.assertObject(button);
					const text = button.value.get("text");
					utils.assertString(text);
					const onClick = button.value.get("onClick");
					utils.assertFunction(onClick);
					const primary = button.value.get("primary");
					if (primary) utils.assertBoolean(primary);
					const rounded = button.value.get("rounded");
					if (rounded) utils.assertBoolean(rounded);
					const disabled = button.value.get("disabled");
					if (disabled) utils.assertBoolean(disabled);

					return {
						text: text.value,
						onClick: async () => {
							await call(onClick, []);
						},
						primary: primary?.value,
						rounded: rounded?.value,
						disabled: disabled?.value,
					};
				})
			: [],
	};
}

function getSwitchOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiSwitch> {
	utils.assertObject(def);

	const onChange = def.value.get("onChange");
	if (onChange) utils.assertFunction(onChange);
	const defaultValue = def.value.get("default");
	if (defaultValue) utils.assertBoolean(defaultValue);
	const label = def.value.get("label");
	if (label) utils.assertString(label);
	const caption = def.value.get("caption");
	if (caption) utils.assertString(caption);

	return {
		onChange: async (v) => {
			if (onChange) await call(onChange, [utils.jsToVal(v)]);
		},
		default: defaultValue?.value,
		label: label?.value,
		caption: caption?.value,
	};
}

function getSelectOptions(
	def: ValuesNS.Value | undefined,
	call: CallFn,
): Options<AsUiSelect> {
	utils.assertObject(def);

	const items = def.value.get("items");
	if (items) utils.assertArray(items);
	const onChange = def.value.get("onChange");
	if (onChange) utils.assertFunction(onChange);
	const defaultValue = def.value.get("default");
	if (defaultValue) utils.assertString(defaultValue);
	const label = def.value.get("label");
	if (label) utils.assertString(label);
	const caption = def.value.get("caption");
	if (caption) utils.assertString(caption);

	return {
		items: items
			? items.value.map((item) => {
					utils.assertObject(item);
					const text = item.value.get("text");
					utils.assertString(text);
					const value = item.value.get("value");
					if (value) utils.assertString(value);
					return {
						text: text.value,
						value: value ? value.value : text.value,
					};
				})
			: [],
		onChange: async (v) => {
			if (onChange) await call(onChange, [utils.jsToVal(v)]);
		},
		default: defaultValue?.value,
		label: label?.value,
		caption: caption?.value,
	};
}

function getFolderOptions(
	def: ValuesNS.Value | undefined,
): Options<AsUiFolder> {
	utils.assertObject(def);

	const children = def.value.get("children");
	if (children) utils.assertArray(children);
	const title = def.value.get("title");
	if (title) utils.assertString(title);
	const opened = def.value.get("opened");
	if (opened) utils.assertBoolean(opened);

	return {
		children: children
			? children.value.map((v) => {
					utils.assertObject(v);
					const id = v.value.get("id");
					utils.assertString(id);
					return id.value;
				})
			: [],
		title: title?.value ?? "",
		opened: opened?.value ?? true,
	};
}

function getPostFormProps(form: ValuesNS.VObj): PostFormPropsForAsUi {
	const text = form.value.get("text");
	utils.assertString(text);
	const cw = form.value.get("cw");
	if (cw) utils.assertString(cw);
	const visibility = form.value.get("visibility");
	if (visibility) utils.assertString(visibility);
	const localOnly = form.value.get("localOnly");
	if (localOnly) utils.assertBoolean(localOnly);

	return {
		text: text.value,
		cw: cw?.value,
		visibility:
			visibility?.value &&
			(misskey.noteVisibilities as readonly string[]).includes(
				visibility.value,
			)
				? (visibility.value as (typeof misskey.noteVisibilities)[number])
				: undefined,
		localOnly: localOnly?.value,
	};
}

function getPostFormButtonOptions(
	def: ValuesNS.Value | undefined,
): Options<AsUiPostFormButton> {
	utils.assertObject(def);

	const text = def.value.get("text");
	if (text) utils.assertString(text);
	const primary = def.value.get("primary");
	if (primary) utils.assertBoolean(primary);
	const rounded = def.value.get("rounded");
	if (rounded) utils.assertBoolean(rounded);
	const form = def.value.get("form");
	if (form) utils.assertObject(form);

	return {
		text: text?.value,
		primary: primary?.value,
		rounded: rounded?.value,
		form: form
			? getPostFormProps(form)
			: {
					text: "",
				},
	};
}

function getPostFormOptions(
	def: ValuesNS.Value | undefined,
): Options<AsUiPostForm> {
	utils.assertObject(def);

	const form = def.value.get("form");
	if (form) utils.assertObject(form);

	return {
		form: form
			? getPostFormProps(form)
			: {
					text: "",
				},
	};
}

/**
 * AiScript に Ui: API を注入し、Vue 側のコンポーネント配列を更新する。
 *
 * @param components - 生成された Ui コンポーネント ref の配列（破壊的に push される）
 * @param done - ルートコンポーネント ref が確定したときに呼ばれるコールバック
 * @param runtime - 動的ロードしたランタイム（省略時は @syuilo/aiscript 0.19.x）
 * @returns Interpreter 定数にマージする Ui: 関数群
 * @public
 */
export function registerAsUiLib(
	components: Ref<AsUiComponent>[],
	done: (root: Ref<AsUiRoot>) => void,
	runtime?: Pick<AiscriptRuntime, "utils" | "values">,
): Record<string, ValuesNS.VFn> {
	// NOTE: FN_NATIVE / STR 等は実行中インタプリタと同じ utils/values を使う
	const aisUtils = runtime?.utils ?? utils;
	const aisValues = runtime?.values ?? values;
	const instances = {} as Record<string, ValuesNS.VObj>;

	function createComponentInstance<T extends AsUiComponent>(
		type: T["type"],
		def: ValuesNS.Value | undefined,
		id: ValuesNS.Value | undefined,
		getOptions: (def: ValuesNS.Value | undefined, call: CallFn) => Options<T>,
		call: CallFn,
	) {
		if (id) aisUtils.assertString(id);
		const _id = id?.value ?? genId();
		const component = ref({
			...getOptions(def, call),
			type,
			id: _id,
		} as T);
		components.push(component);
		const instance = aisValues.OBJ(
			new Map<string, ValuesNS.Value>([
				["id", aisValues.STR(_id)],
				[
					"update",
					aisValues.FN_NATIVE(([def]) => {
						aisUtils.assertObject(def);
						const updates = getOptions(def, call);
						for (const update of def.value.keys()) {
							if (
								!Object.prototype.hasOwnProperty.call(
									updates,
									update,
								)
							)
								continue;
							(component.value as Record<string, unknown>)[update] =
								(updates as Record<string, unknown>)[update];
						}
					}),
				],
			]),
		);
		instances[_id] = instance;
		return instance;
	}

	const rootInstance = createComponentInstance(
		"root",
		aisUtils.jsToVal({ children: [] }),
		aisValues.STR("___root___"),
		getRootOptions as (
			def: ValuesNS.Value | undefined,
			call: CallFn,
		) => Options<AsUiRoot>,
		async () => aisValues.NULL,
	);
	const rootComponent = components[0] as Ref<AsUiRoot>;
	done(rootComponent);

	return {
		"Ui:root": rootInstance,

		"Ui:patch": aisValues.FN_NATIVE(([id, val]) => {
			aisUtils.assertString(id);
			aisUtils.assertArray(val);
			// NOTE: Misskey 本家でも未実装
		}),

		"Ui:get": aisValues.FN_NATIVE(([id]) => {
			aisUtils.assertString(id);
			const instance = instances[id.value];
			return instance ?? aisValues.NULL;
		}),

		"Ui:render": aisValues.FN_NATIVE(([children]) => {
			aisUtils.assertArray(children);

			rootComponent.value.children = children.value.map((v) => {
				aisUtils.assertObject(v);
				const id = v.value.get("id");
				aisUtils.assertString(id);
				return id.value;
			});
		}),

		"Ui:C:container": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"container",
				def,
				id,
				getContainerOptions as (
					def: ValuesNS.Value | undefined,
					call: CallFn,
				) => Options<AsUiContainer>,
				opts.topCall,
			);
		}),

		"Ui:C:text": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"text",
				def,
				id,
				getTextOptions as (
					def: ValuesNS.Value | undefined,
					call: CallFn,
				) => Options<AsUiText>,
				opts.topCall,
			);
		}),

		"Ui:C:mfm": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"mfm",
				def,
				id,
				getMfmOptions,
				opts.topCall,
			);
		}),

		"Ui:C:textarea": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"textarea",
				def,
				id,
				getTextareaOptions,
				opts.topCall,
			);
		}),

		"Ui:C:textInput": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"textInput",
				def,
				id,
				getTextInputOptions,
				opts.topCall,
			);
		}),

		"Ui:C:numberInput": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"numberInput",
				def,
				id,
				getNumberInputOptions,
				opts.topCall,
			);
		}),

		"Ui:C:button": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"button",
				def,
				id,
				getButtonOptions,
				opts.topCall,
			);
		}),

		"Ui:C:buttons": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"buttons",
				def,
				id,
				getButtonsOptions,
				opts.topCall,
			);
		}),

		"Ui:C:switch": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"switch",
				def,
				id,
				getSwitchOptions,
				opts.topCall,
			);
		}),

		"Ui:C:select": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"select",
				def,
				id,
				getSelectOptions,
				opts.topCall,
			);
		}),

		"Ui:C:folder": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"folder",
				def,
				id,
				getFolderOptions as (
					def: ValuesNS.Value | undefined,
					call: CallFn,
				) => Options<AsUiFolder>,
				opts.topCall,
			);
		}),

		"Ui:C:postFormButton": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"postFormButton",
				def,
				id,
				getPostFormButtonOptions as (
					def: ValuesNS.Value | undefined,
					call: CallFn,
				) => Options<AsUiPostFormButton>,
				opts.topCall,
			);
		}),

		"Ui:C:postForm": aisValues.FN_NATIVE(([def, id], opts) => {
			return createComponentInstance(
				"postForm",
				def,
				id,
				getPostFormOptions as (
					def: ValuesNS.Value | undefined,
					call: CallFn,
				) => Options<AsUiPostForm>,
				opts.topCall,
			);
		}),
	};
}
