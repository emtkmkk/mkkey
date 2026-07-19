# Reaction count view model cases

`useReactionCountViewModel` の表示仕様を確認するためのケース表。

| ケース | ★ボタン表示 (`showStarButtonNoEmoji`) | picker表示 (`showReactionPickerButton`) | undo表示 (`showUndoReactionButton`) | reaction list表示 (`isReactionListVisible`) | `useSplitReactionCounts` | ★カウント (`showStarCount`) | picker/undoカウント | picker/undoカウント表示 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A: ★のみ | ✅ | ❌ | ❌ | ❌ | ❌ | 全リアクション (1以上で表示) | - | - |
| B: ★のみ + list表示 | ✅ | ❌ | ❌ | ✅ | ❌ | デフォルトリアクション (1以上で表示) | - | - |
| C: ★+picker | ✅ | ✅ | ❌ | ❌ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ✅ (0より大きい時) |
| D: ★+picker + list表示 | ✅ | ✅ | ❌ | ✅ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ❌ |
| E: ★+undo | ✅ | ❌ | ✅ | ❌ | ✅ | デフォルトリアクション | 非デフォルトリアクション | ✅ (0より大きい時) |
| H: splitでない picker/undo | ❌ | ✅/❌ | ✅/❌ | ❌ | ❌ | - | 全リアクション | ✅ (0より大きい時) |
| I: splitでない picker/undo + list表示 | ❌ | ✅/❌ | ✅/❌ | ✅ | ❌ | - | デフォルトリアクション | ✅ (0より大きい時) |

> **NOTE**: 旧版にあった「F/G: ★なし + split扱い」は数学的に到達不能なため削除した。
> `useSplitReactionCounts` が真になる経路は次の2つのみ:
>
> 1. `showStarAndPickerButtons`（`showStarButtonNoEmoji && (picker || undo)`）— 常に `showStarButtonNoEmoji` を要求する
> 2. `isStarButtonHandlesDefault && picker && undo` の同時成立 — 非multiでは undo が `myReaction != null`（＝`isMaxReacted`）を要求する一方、
>    picker は `!isMaxReacted` を要求するため、picker と undo が同時に true になることはない（常に排他）
>
> したがって `useSplitReactionCounts` は常に `showStarButtonNoEmoji === true` を含意し、
> `countForReactionPickerButton`/`countForUndoReactionButton` にあった「★非表示時」の分岐は
> 実装側でも削除済み（`countForPickerButton` と常に同値）。

## tooltip API クエリ

| 条件 | `tooltipQuery.shouldSkip` | `type` | `excludeType` | `count` |
| --- | --- | --- | --- | --- |
| splitかつlist表示 | `true` | - | - | - |
| split (list非表示) | `false` | `null` | `instance.defaultReaction` | 非デフォルトリアクション |
| splitでない + list表示 | `false` | `instance.defaultReaction` | `null` | デフォルトリアクション |
| splitでない + list非表示 | `false` | `null` | `null` | 全リアクション |
