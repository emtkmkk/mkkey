Misskeyの翻訳
============

Misskey内の未翻訳箇所を見つけたら
-------------------------------

1. Misskeyのソースコード内から未翻訳箇所を探してください。
	- 例えば`src/client/app/mobile/views/pages/home.vue`で未翻訳箇所を見つけたとします。

2. 未翻訳箇所を`%i18n:@foo%`のような形式の文字列に置換してください。
	- `foo`は実際にはその場に適したわかりやすい(英語の)名前にしてください。
	- 例えば未翻訳箇所が「タイムライン」というテキストだった場合、`%i18n:@timeline%`のようにします。

3. `locales/ja-JP.yml`を開き、1.で見つけた<strong>ファイル名(パス)</strong>のキーが存在するか確認し、無ければ作成してください。
	- パスの`src/client/app/`は省略してください。
	- 例えば、今回の例では`src/client/app/mobile/views/pages/home.vue`の未翻訳箇所を修正したいので、キーは`mobile/views/pages/home.vue`になります。

4. そのキーの直下に2.で置換した`foo`の部分をキーとし、テキストを値とするプロパティを追加します。
	- 例えば、今回の例で言うと`locales/ja-JP.yml`に`timeline: "タイムライン"`を追加します。

5. 完了です！

詳しくは、[このコミット](https://github.com/syuilo/misskey/commit/10f6d5980fa7692ccb45fbc5f843458b69b7607c)などを参考にしてください。
