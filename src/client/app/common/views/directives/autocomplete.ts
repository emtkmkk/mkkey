import * as getCaretCoordinates from 'textarea-caret';
import MkAutocomplete from '../components/autocomplete.vue';
import renderAcct from '../../../../../misc/acct/render';

export default {
	bind(el, binding, vn) {
		const self = el._autoCompleteDirective_ = {} as any;
		self.x = new Autocomplete(el, vn.context, binding.value);
		self.x.attach();
	},

	unbind(el, binding, vn) {
		const self = el._autoCompleteDirective_;
		self.x.detach();
	}
};

/**
 * オートコンプリートを管理するクラス。
 */
class Autocomplete {
	private suggestion: any;
	private textarea: any;
	private vm: any;
	private model: any;
	private currentType: string;

	private get text(): string {
		return this.vm[this.model];
	}

	private set text(text: string) {
		this.vm[this.model] = text;
	}

	/**
	 * 対象のテキストエリアを与えてインスタンスを初期化します。
	 */
	constructor(textarea, vm, model) {
		//#region BIND
		this.onInput = this.onInput.bind(this);
		this.complete = this.complete.bind(this);
		this.close = this.close.bind(this);
		//#endregion

		this.suggestion = null;
		this.textarea = textarea;
		this.vm = vm;
		this.model = model;
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを開始します。
	 */
	public attach() {
		this.textarea.addEventListener('input', this.onInput);
	}

	/**
	 * このインスタンスにあるテキストエリアの入力のキャプチャを解除します。
	 */
	public detach() {
		this.textarea.removeEventListener('input', this.onInput);
		this.close();
	}

	/**
	 * テキスト入力時
	 */
	private onInput() {
		const caretPos = this.textarea.selectionStart;
		const text = this.text.substr(0, caretPos).split('\n').pop();

		const mentionIndex = text.lastIndexOf('@');
		const hashtagIndex = text.lastIndexOf('#');
		const emojiIndex = text.lastIndexOf(':');

		const max = Math.max(
			mentionIndex,
			hashtagIndex,
			emojiIndex);

		if (max == -1) {
			this.close();
			return;
		}

		const isMention = mentionIndex != -1;
		const isHashtag = hashtagIndex != -1;
		const isEmoji = emojiIndex != -1;

		let opened = false;

		if (isMention) {
			const username = text.substr(mentionIndex + 1);
			if (username != '' && username.match(/^[a-zA-Z0-9_]+$/)) {
				this.open('user', username);
				opened = true;
			}
		}

		if (isHashtag && opened == false) {
			const hashtag = text.substr(hashtagIndex + 1);
			if (!hashtag.includes(' ')) {
				this.open('hashtag', hashtag);
				opened = true;
			}
		}

		if (isEmoji && opened == false) {
			const emoji = text.substr(emojiIndex + 1);
			if (emoji != '' && emoji.match(/^[\+\-a-z0-9_]+$/)) {
				this.open('emoji', emoji);
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
	private open(type, q) {
		if (type != this.currentType) {
			this.close();
		}
		this.currentType = type;

		//#region サジェストを表示すべき位置を計算
		const caretPosition = getCaretCoordinates(this.textarea, this.textarea.selectionStart);

		const rect = this.textarea.getBoundingClientRect();

		const x = rect.left + caretPosition.left - this.textarea.scrollLeft;
		const y = rect.top + caretPosition.top - this.textarea.scrollTop;
		//#endregion

		if (this.suggestion) {
			this.suggestion.x = x;
			this.suggestion.y = y;
			this.suggestion.q = q;
		} else {
			// サジェスト要素作成
			this.suggestion = new MkAutocomplete({
				propsData: {
					textarea: this.textarea,
					complete: this.complete,
					close: this.close,
					type: type,
					q: q,
					x,
					y
				}
			}).$mount();

			// 要素追加
			document.body.appendChild(this.suggestion.$el);
		}
	}

	/**
	 * サジェストを閉じます。
	 */
	private close() {
		if (this.suggestion == null) return;

		this.suggestion.$destroy();
		this.suggestion = null;

		this.textarea.focus();
	}

	/**
	 * オートコンプリートする
	 */
	private complete(type, value) {
		this.close();

		const caret = this.textarea.selectionStart;

		if (type == 'user') {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('@'));
			const after = source.substr(caret);

			const acct = renderAcct(value);

			// 挿入
			this.text = `${trimmedBefore}@${acct} ${after}`;

			// キャレットを戻す
			this.vm.$nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (acct.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (type == 'hashtag') {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf('#'));
			const after = source.substr(caret);

			// 挿入
			this.text = `${trimmedBefore}#${value} ${after}`;

			// キャレットを戻す
			this.vm.$nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + (value.length + 2);
				this.textarea.setSelectionRange(pos, pos);
			});
		} else if (type == 'emoji') {
			const source = this.text;

			const before = source.substr(0, caret);
			const trimmedBefore = before.substring(0, before.lastIndexOf(':'));
			const after = source.substr(caret);

			// 挿入
			this.text = trimmedBefore + value + after;

			// キャレットを戻す
			this.vm.$nextTick(() => {
				this.textarea.focus();
				const pos = trimmedBefore.length + 1;
				this.textarea.setSelectionRange(pos, pos);
			});
		}
	}
}
