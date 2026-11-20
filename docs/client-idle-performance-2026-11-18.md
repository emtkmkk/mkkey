# クライアント長時間稼働時の負荷・蓄積の修正

## 概要

調査で再現した絵文字情報の重複、画像の再設定、タイマーの増殖を先に直す。
続いてプロキシ確認の重複通信と、解除漏れ・上限のない保持領域を修正する。

## 配置と構成

- [use-note-capture.ts](../packages/client/src/scripts/use-note-capture.ts): 同じ名前の絵文字は差分がある場合だけ更新。
- [emoji-src.ts](../packages/client/src/directives/emoji-src.ts)、[MkEmoji.vue](../packages/client/src/components/global/MkEmoji.vue): 同じ画像を再設定せず、リモートの直接URLも読み込み制限に含める。破棄した要素は待機列から即時に削除。
- [MkAvatars.vue](../packages/client/src/components/MkAvatars.vue): 一覧更新とタイマーの寿命を分離。
- [media-proxy-fallback.ts](../packages/client/src/scripts/media-proxy-fallback.ts): 確認通信の共有・同時数・待機数・待ち時間を制限。
- [limited-cache.ts](../packages/client/src/scripts/limited-cache.ts): 件数上限付きLRUキャッシュを共通化。
- [MkCategoryFollowButton.vue](../packages/client/src/components/MkCategoryFollowButton.vue)、[plugin.ts](../packages/client/src/plugin.ts)、[use-remote-references.ts](../packages/client/src/composables/use-remote-references.ts): 監視の解除と保持件数の制限。
- [client-idle-performance.test.cjs](../scripts/tests/client-idle-performance.test.cjs): 実ソースとVueを使う回帰テスト。通信・DOM・時計は置き換える。

## 方針メモ

判断の軸: 表示・権限・失敗時の切り替えを保ち、重複した仕事と不要な保持を取り除く。

## 設計方針

取得中の同一URLは同じPromiseを共有する。プロキシ確認の失敗・期限超過・過負荷は、
従来の「エラー画像と断定できない」扱いを保つ。画像の制限と確認通信の制限は別に管理する。
非表示中のWebSocket購読を止めるような広い挙動変更は行わない。

## 機能一覧

- 絵文字情報: 名前で照合し、URL等が変わったときだけ配列を置き換える。
- 画像: 最後に設定したURLを保持し、同じ値のVue更新では触らない。
- 定期取得: タイマーは一つ。間隔変更時は交換、破棄時は解除。
- プロキシ確認: 最大3件同時、最大128件保持、要求から10秒で期限切れ。成功URLは最大512件。
- キャッシュ: 参照一覧は最近使った100投稿分、プラグインログは最近の200件。

## 非実装

- 本番デプロイ。コードの共有と、本番への反映は分けて扱う。
- 非表示中の全通信停止、画像アニメーションの強制停止、新しい設定UI。
- Windows全体の遅延が解消するという保証。ブラウザーでの長時間実測は別途必要。

## 決定事項

- API・絵文字のフォールバック順・権限フラグは保つ。
- 既存の再現ハーネスと、リポジトリのTypeScript・Vueコンパイラーを再利用する。
- 参照キャッシュの追い出し後は、次の利用時に再取得する。

## 実装手順

1. 絵文字情報の重複と同じ画像の再設定を修正。
2. アバター一覧のタイマーを修正。
3. 確認通信とキャッシュを制限し、直接URLも画像待機列で扱う。
4. 残る監視解除漏れ・ログ保持を修正。
5. 回帰テスト、変更したTypeScriptの検査、型チェック、クライアントビルドを実行。

## 検証結果

- `pnpm run test:client-idle`: 追加修正後は27件成功。実際のMkEmoji・Vue再描画、フォールバック、期限切れ後の遅い応答も確認。
- `pnpm run typecheck`: 既存74件のまま、新規なし。clientは既存の運用どおり対象外。
- 変更したクライアントTSを同一依存環境で修正前の`fe6cf1390d`と比較: 診断28件から27件、新規なし。
- 通常出力先のビルドは、過去の生成物約2.2万件を圧縮する段階で`EMFILE`になった。
  既存生成物を削除せず、新しい出力先を指定した`pnpm --filter client exec vite build --outDir ...`で圧縮まで完了することを確認。
  チャンクサイズ等の既存構成に関する警告あり。
- 主要5件の回帰テストは修正前の`fe6cf1390d`では失敗し、修正後は成功することを確認。
- 変更TS・テスト補助へのRome検査: 新規指摘なし。plugin.tsの既存2件を`fe6cf1390d`でも確認。
- RomeはVueファイルを直接扱えない。Vueは実コンパイラーとビルドで検査し、vue-tscでの全体型検査は未実施。
- 実ブラウザーでの長時間放置、ネットワーク実通信、今回のWindows遅延の解消確認、本番デプロイは未実施。

## 副作用を抑えた追加修正

判断の軸: 表示中の更新方法を変えず、破棄済み処理と不要な監視を除く。

1. [ユーザープロフィール](../packages/client/src/pages/user/home.vue)の初回描画予約も解除し、破棄後の再予約を防止。
2. [投稿詳細](../packages/client/src/components/MkNoteDetailed.vue)のwheel監視を解除し、破棄後に返った返信取得結果を追加しない。
3. [ページ送り](../packages/client/src/components/MkPagination.vue)のコンテナー差し替え時に、古いスクロール監視を解除。
4. TL待機列の監視を件数だけに限定。通知する件数・追従状態の形式は維持する。

この段階では行わなかったこと: 非表示・KeepAlive中の全通信停止、返信の保持件数変更、時刻表示の共通化。
これらは復帰時の再取得や表示の鮮度と一緒に設計する必要があるため、今回の解除漏れ修正とは分ける。

追加の回帰テスト6件は、初回描画前の破棄・遅いコールバック・破棄後の返信応答・
監視対象の差し替え・待機件数通知を検査する。修正前の`fe6cf1390d`では6件失敗し、修正後は6件成功。
型チェックは既存74件のまま、新規なし。追加したテストのRome検査も成功。
追加修正を含むビルドも、新しい隔離出力先で圧縮まで成功した。

## 続き: 入力欄と時刻表示の定期処理

判断の軸: 表示の意味・更新間隔を保ち、周期測定とタイマー本数を減らす。

1. [入力欄](../packages/client/src/components/form/input.vue)と[選択欄](../packages/client/src/components/form/select.vue)の装飾幅測定を[ResizeObserverによる共通処理](../packages/client/src/scripts/use-input-decorations.ts)へ移す。
2. [MkTime](../packages/client/src/components/global/MkTime.vue)は[共有時計](../packages/client/src/scripts/shared-time-ticker.ts)へ登録する。更新間隔を変えず、期限に達した表示だけ更新する。
3. タブ非表示中とKeepAlive退避中の時刻更新を止める。復帰時は実時刻から一度だけ再計算する。
4. 入力内容・カウントダウン・復帰・破棄・タイマー共有を回帰テストし、型検査と隔離ビルドを行う。

非実装: ウィジェットAPIの一括停止、返信保持件数の変更。表示の鮮度や再取得方法の設計が必要なため、この段階では変更しない。

予約の期限には`performance.now()`を使い、OS時計の補正で更新が長時間止まることを防ぐ。
表示する日時には引き続き実時刻を使う。全表示を共通のリアクティブ値へ結び付けず、更新期限に達した表示だけを更新する。

### この段階の検証結果

- `pnpm run test:client-idle`: 新規15件を含む42件成功。
- 実際のVueコンポーネントを使うテストで、時刻表示10個のタイマーが1本、タブ非表示中・KeepAlive退避中は0本になることを確認。
- 入力値の通知、装飾幅の変更、要素差し替え、破棄後の通知、カウントダウンの復帰、時計補正、例外後の他表示の継続を検査。
- この段階の主要5件は修正前の`90402027aa`で失敗し、修正後に成功することを確認。
- 新規共通処理2ファイルの厳密なTypeScript検査と、共通処理・テスト・補助へのRome検査が成功。
- `pnpm run typecheck`: 既存74件のまま、新規なし。clientは引き続き対象外で、Vue全体の型検査を行ったという意味ではない。
- 新しい隔離出力先でクライアントビルドが圧縮まで完了。チャンクサイズ等の警告あり。
- 実ブラウザーでの長時間放置と実画面の確認、本番デプロイは未実施。この変更だけでWindows全体の遅延原因が確定したとは扱わない。
