/**
 * @packageDocumentation
 * 長時間開くクライアントのキャッシュを件数で制限する。
 * @remarks バックエンドのLRU方針を、サーバー依存なしで利用する。
 * @see {@link LimitedCache}
 * @internal
 */

/**
 * 最近使用した値を優先して保持するキャッシュ。
 * @remarks 値は複製しない。上限は件数であり、各値のバイト数は制限しない。
 * @internal
 */
export class LimitedCache<K, V> {
	/** 読み出し順を末尾へ反映する内部ストレージ。 @internal */
	private readonly values = new Map<K, V>();

	/**
	 * 保持件数の上限を設定する。
	 * @remarks 不正な上限は、無制限保持として解釈せず例外にする。
	 * @param maxEntries - 1以上の整数
	 * @throws RangeError - 上限が正の整数でない場合
	 * @internal
	 */
	constructor(private readonly maxEntries: number) {
		if (!Number.isInteger(maxEntries) || maxEntries < 1) {
			throw new RangeError("maxEntries must be a positive integer");
		}
	}

	/**
	 * 値を取得し、最近使った項目として扱う。
	 * @remarks 未登録のキーでは順序を変更しない。
	 * @param key - 読み出すキー
	 * @returns 保存値。未登録ならundefined
	 * @internal
	 */
	get(key: K): V | undefined {
		if (!this.values.has(key)) return undefined;
		const value = this.values.get(key) as V;
		this.values.delete(key);
		this.values.set(key, value);
		return value;
	}

	/**
	 * 値を保存し、上限超過時は最も長く使っていない項目を除く。
	 * @remarks 同じキーへの上書きでは保持件数を増やさない。
	 * @param key - 保存するキー
	 * @param value - 保存する値
	 * @returns なし
	 * @internal
	 */
	set(key: K, value: V): void {
		this.values.delete(key);
		this.values.set(key, value);
		if (this.values.size > this.maxEntries) {
			this.values.delete(this.values.keys().next().value as K);
		}
	}

	/** 保存件数。 @remarks 診断用の値で、内容は公開しない。 @internal */
	get size(): number {
		return this.values.size;
	}

	/** 全項目を破棄する。 @remarks キャッシュの寿命を終了させる。 @returns なし @internal */
	clear(): void {
		this.values.clear();
	}
}
