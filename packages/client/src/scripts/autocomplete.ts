import { nextTick, Ref, ref, defineAsyncComponent } from "vue";
import getCaretCoordinates from "textarea-caret";
import { toASCII } from "punycode/";
import { popup } from "@/os";
import { defaultStore } from "@/store";

export class Autocomplete {
	private suggestion: {
		x: Ref<number>;
		y: Ref<number>;
		q: Ref<string | null>;
		close: () => void;
	} | null;
	private textarea: HTMLInputElement | HTMLTextAreaElement;
	private currentType: string;
	private textRef: Ref<string>;
	private opening: boolean;

	private get text(): string {
		return this.textRef.value;
	}

	private set text(text: string) {
		this.textRef.value = text;
	}

	/**
	 * 対象のテキストエリアを与えてインスタンスを初期化します。
	 */
	constructor(
		textarea: HTMLInputElement | HTMLTextAreaElement,
		textRef: Ref<string>,
	) {
		//#region BIND
		this.onInput = this.onInput.bind(this);
		this.complete = this.complete.bind(this);
		this.close = this.close.bind(this);
		//#endregion

		this.suggestion = null;
		this.textarea = textarea;
		this.textRef = textRef;
		this.opening = false;

		this.attach();
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを開始します。
	 */
	public attach() {
		this.textarea.addEventListener("input", this.onInput);
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを解除します。
	 */
	public detach() {
		this.textarea.removeEventListener("input", this.onInput);
		this.close();
	}

	/**
	 * テキスト入力時
	 */
	private onInput() {
		const caretPos = this.textarea.selectionStart;
		const text = this.text.substr(0, caretPos).split("\n").pop()!;

		const mentionIndex = text.lastIndexOf("@");
		const hashtagIndex = text.lastIndexOf("#");
		const emojiIndex = text.lastIndexOf(":");
		const mfmTagIndex = text.lastIndexOf("$");

		const max = Math.max(mentionIndex, hashtagIndex, emojiIndex, mfmTagIndex);

		if (max === -1) {
			this.close();
			return;
		}

		const isMention = mentionIndex !== -1;
		const isHashtag = hashtagIndex !== -1;
		const isMfmTag = mfmTagIndex !== -1;
		const isEmoji =
			emojiIndex !== -1 && text.split(/:[a-z0-9_+\-.@]+:/).pop()!.includes(":");

		let opened = false;

		if (isMention) {
			const username = text.substr(mentionIndex + 1);
			if (username !== "" && username.match(/^[a-zA-Z0-9_]+$/)) {
				this.open("user", username);
				opened = true;
			} else if (username === "") {
				this.open("user", null);
				opened = true;
			}
		}

		if (isHashtag && !opened) {
			const hashtag = text.substr(hashtagIndex + 1);
			if (!hashtag.includes(" ")) {
				this.open("hashtag", hashtag);
				opened = true;
			}
		}

		if (isMfmTag && !opened) {
			const mfmTag = text.substr(mfmTagIndex + 1);
			if (!mfmTag.includes(" ")) {
				this.open("mfmTag", mfmTag.replace("[", ""));
				opened = true;
			}
		}

		if (isEmoji && !opened) {
			const emoji = text.substr(emojiIndex + 1);
			if (!emoji.includes(" ")) {
				this.open("emoji", emoji);
				opened = true;
			}
		}

		if (!opened) {
			this.close();
		}
	}

	/**
	 * サジェストを提示します。
	 */
	private async open(type: string, q: string | null) {
		if (type !== this.currentType) {
			this.close();
		}
		if (this.opening) return;
		this.opening = true;
		this.currentType = type;

		//#region サジェストを表示すべき位置を計算
		const caretPosition = getCaretCoordinates(
			this.textarea,
			this.textarea.selectionStart,
		);

		const rect = this.textarea.getBoundingClientRect();

		const x = rect.left + caretPosition.left - this.textarea.scrollLeft;
		const y = rect.top + caretPosition.top - this.textarea.scrollTop;
		//#endregion

		if (this.suggestion) {
			this.suggestion.x.value = x;
			this.suggestion.y.value = y;
			this.suggestion.q.value = q;

			this.opening = false;
		} else {
			const _x = ref(x);
			const _y = ref(y);
			const _q = ref(q);

			const { dispose } = await popup(
				defineAsyncComponent(() => import("@/components/MkAutocomplete.vue")),
				{
					textarea: this.textarea,
					close: this.close,
					type: type,
					q: _q,
					x: _x,
					y: _y,
				},
				{
					done: (res) => {
						this.complete(res);
					},
				},
			);

			this.suggestion = {
				q: _q,
				x: _x,
				y: _y,
				close: () => dispose(),
			};

			this.opening = false;
		}
	}

	/**
	 * サジェストを閉じます。
	 */
	private close() {
		if (this.suggestion == null) return;

		this.suggestion.close();
		this.suggestion = null;

		this.textarea.focus();
	}

	/**
	 * オートコンプリートする
	 */
	private complete({ type, value }) {
		this.close();

		const caret = this.textarea.selectionStart;

		if (type === "user") {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf("@"));
			const after = source.substr(caret);

			const acct =
				value.host === null
					? value.username
					: `${value.username}@${toASCII(value.host)}`;

			// 挿入
			this.text = `${trimmedBefore}@${acct} ${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (acct.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (type === "hashtag") {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf("#"));
			const after = source.substr(caret);

			// 挿入
			this.text = `${trimmedBefore}#${value} ${after}`;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (value.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (type === "emoji") {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf(":"));
			const after = source.substr(caret);

			// 挿入
			this.text = trimmedBefore + value + after;

			// キャレットを戻す
			nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + value.length;
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (type === "mfmTag") {
			const source = this.text;

			const before = source.substr(0, caret);
			let trimmedBefore = before.substring(0, before.lastIndexOf("$"));
			let after = source.substr(caret);
			let target = undefined;

			if (defaultStore.reactiveState.smartMFMInputer.value) {
				// afterの中に1種類の終了タグのみ含まれている場合
				// afterは指定していないことにする
				if (/^(<\/\w*>|\*\*|~~|\n```|\\\)|\\\]|[`\]])$/.test(after)) {
					trimmedBefore += after;
					after = "";
				}
				// afterの中に改行が含まれる場合、そこまでを中に入れる対象とする
				const regex = /^([^\n]*)\n([\S\s]*)$/.exec(after);
				if (regex) {
					target = regex[1];
					after = "\n" + regex[2];
				}
			}

			// 挿入
			const mfmValue = value.defaultOption ?? value.exportLeft
			if (defaultStore.reactiveState.smartMFMInputer.value) {
				// スマートモード
				// 右に文字列無し : textを全て囲む
				// 右に文字列有り : 右の文字列を改行まで全て囲む
				this.text = after.length === 0
					? `${mfmValue}${trimmedBefore}${value.exportRight}`
					: target
						? `${trimmedBefore}${mfmValue}${target}${value.exportRight}${after}`
						: `${trimmedBefore}${mfmValue}${after}${value.exportRight}`;

				// キャレットを戻す
				// 末尾から閉じタグ以外の文字が出てくる後の文字に合わせる
				const trimText = target
					? `${mfmValue}${target}${value.exportRight}`
					: `${mfmValue}${after}${value.exportRight}`;

				nextTick(() => {
					this.textarea.focus();
					const regex = /\n?(<\/\w*>|\\\)|\\\]|\s\[Search\]|\s\[検索\]|[\]*~`])+$/.exec(trimText);
					const pos = regex
						? trimmedBefore.length + (trimText.length - regex[0].length)
						: trimmedBefore.length + trimText.length;

					this.textarea.setSelectionRange(pos, pos);
				});

			} else {

				// 通常モード
				// キャレット位置に空白のタグを生成する
				this.text = `${trimmedBefore}${mfmValue}${value.exportRight}${after}`;

				// キャレットを戻す
				nextTick(() => {
					this.textarea.focus();
					const pos = trimmedBefore.length + (mfmValue.length);
					this.textarea.setSelectionRange(pos, pos);
				});
			}
		}
	}
}
