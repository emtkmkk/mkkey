<template>
	<span v-if="user.isDeleted">
		<slot></slot>
	</span>
	<MkA
		v-else
		v-user-preview="preview ? user.id : undefined"
		:to="userPage(user)"
	>
		<slot></slot>
	</MkA>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ユーザーのプロフィールへのリンク（名前などを包む）。削除済みの人なら、リンクにせずただの文字にする。
 *
 * @remarks
 * - 削除済み（`user.isDeleted`）の人のプロフィールは「削除されたか、見つかりません」になるので、
 *   押しても行き先が無い。通知・リアクションした人の一覧・スレッドの抜け殻の作者名などで使う。
 * - `class` や `@click.stop` は、どちらの場合も外側の要素に付く（Vue の属性の引き継ぎ）。
 * - アイコンは {@link MkAvatar} が同じ判断を自分でしている。
 *
 * @example
 * ```vue
 * <MkUserLink :user="note.user" class="name"><MkUserName :user="note.user" /></MkUserLink>
 * ```
 *
 * @public
 */
import type * as misskey from "calckey-js";
import { userPage } from "@/filters/user";

withDefaults(
	defineProps<{
		/** リンク先のユーザー */
		user: misskey.entities.User;
		/** マウスを乗せたときにユーザーのプレビューを出すか */
		preview?: boolean;
	}>(),
	{
		preview: true,
	},
);
</script>
