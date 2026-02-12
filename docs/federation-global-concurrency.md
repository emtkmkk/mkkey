# Federation note create concurrency の運用メモ

## 設定

`federationGlobalConcurrency` は連合由来（リモートユーザー投稿）のノート作成処理にだけ適用される同時実行上限です。
未設定時は `2` が使われます。

```yml
federationGlobalConcurrency: 2
```

## ログ確認

以下のログを確認します。

- `federation_note_create_wait_start`
- `federation_note_create_wait_end`
- `federation_note_create_execute_start`
- `api_response_ms=...`（既存の `note-deliver-metric`）

```bash
journalctl -u mkkey.net -S "-30 min" | grep "note-deliver-metric"
```

## `api_response_ms` の比較手順（p95/p99 と >3s 件数）

1. 変更前と変更後で同じ時間帯（例: 各30分）を採取する。
2. `api_response_ms` を抽出して p95 / p99 を比較する。
3. `api_response_ms > 3000` の件数を比較する。

例（jq が使える場合）:

```bash
journalctl -u mkkey.net -S "-30 min" \
  | grep "note-deliver-metric" \
  | sed -n 's/.*api_response_ms=\([0-9]\+\).*/\1/p' \
  | jq -s 'sort | {count:length, p95:.[(length*0.95|floor)], p99:.[(length*0.99|floor)], gt3s:map(select(.>3000))|length}'
```

## 推奨チューニング基準（短縮版）

- `wait_ms` が常時高く、かつ `api_response_ms` の p95/p99 や `>3s` 件数が悪化する場合:
  - `2 -> 3` を試す。
- DB や I/O の負荷が高く、`api_response_ms` の長尾（p99, >3s）が悪化する場合:
  - `2 -> 1` を試す。
- 変更は1段階ずつ行い、同条件で再計測して判断する。
