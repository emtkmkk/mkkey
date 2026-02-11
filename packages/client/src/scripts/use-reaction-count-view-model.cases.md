# Reaction count view model cases

`useReactionCountViewModel` の表示仕様を確認するためのケース表。

| ケース | ★ボタン表示 (`showStarButtonNoEmoji`) | picker表示 (`showReactionPickerButton`) | undo表示 (`showUndoReactionButton`) | reaction list表示 (`isReactionListVisible`) | `useSplitReactionCounts` | ★カウント | picker/undoカウント | picker/undoカウント表示 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A: ★のみ | ✅ | ❌ | ❌ | ❌ | ❌ | 全リアクション | - | - |
| B: ★のみ + list表示 | ✅ | ❌ | ❌ | ✅ | ❌ | デフォルトリアクション | - | - |
| C: ★+picker | ✅ | ✅ | ❌ | ❌ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ✅ (0より大きい時) |
| D: ★+picker + list表示 | ✅ | ✅ | ❌ | ✅ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ❌ |
| E: ★+undo | ✅ | ❌ | ✅ | ❌ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ✅ (0より大きい時) |
| F: ★なし + picker/undo + split扱い | ❌ | ✅ | ✅ | ❌ | ✅ | - | picker: デフォルト / undo: 非デフォルト | ✅ (0より大きい時) |
| G: ★なし + picker/undo + split扱い + list表示 | ❌ | ✅ | ✅ | ✅ | ✅ | - | picker: デフォルト / undo: 非デフォルト | ❌ |
| H: splitでない picker/undo | ❌ | ✅/❌ | ✅/❌ | ❌ | ❌ | - | 全リアクション | ✅ (0より大きい時) |
| I: splitでない picker/undo + list表示 | ❌ | ✅/❌ | ✅/❌ | ✅ | ❌ | - | デフォルトリアクション | ✅ (0より大きい時) |

## tooltip API クエリ

| 条件 | `tooltipQuery.shouldSkip` | `type` | `excludeType` | `count` |
| --- | --- | --- | --- | --- |
| splitかつlist表示 | `true` | - | - | - |
| split (list非表示) | `false` | `null` | `instance.defaultReaction` | 非デフォルトリアクション |
| splitでない + list表示 | `false` | `instance.defaultReaction` | `null` | デフォルトリアクション |
| splitでない + list非表示 | `false` | `null` | `null` | 全リアクション |
