<template>
	<div v-if="$i" class="_panel mkw-profile">
		<div
			class="container"
			:style="{
				backgroundImage: $i.bannerUrl
					? `url(${$i.bannerUrl})`
					: undefined,
			}"
		>
			<div class="avatarContainer">
				<MkAvatar class="avatar" :user="$i" />
			</div>
			<div class="bodyContainer">
				<div class="body">
					<MkA class="name" :to="userPage($i)">
						<MkUserName :user="$i" />
					</MkA>
					<div class="username">
						<MkAcct :user="$i" detail />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ログインユーザーのプロフィールをバナー風に表示するウィジェット。
 *
 * @remarks
 * - 未ログイン時は何も描画しない
 * - 設定項目は本家 Misskey と同様に無し
 *
 * @public
 */
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentEmits,
	WidgetComponentExpose,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import { $i } from "@/account";
import { userPage } from "@/filters/user";

// #region ウィジェット定義

const name = "profile";

/** 設定項目なし（本家 WidgetProfile と同様） */
const widgetPropsDef = {} as const;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

// #endregion

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.mkw-profile {
	.container {
		position: relative;
		background-size: cover;
		background-position: center;
		display: flex;
	}

	.avatarContainer {
		display: inline-block;
		text-align: center;
		padding: 1rem;
	}

	.avatar {
		display: inline-block;
		width: 3.75rem;
		height: 3.75rem;
		box-sizing: border-box;
		border: solid 3px #fff;
	}

	.bodyContainer {
		display: flex;
		align-items: center;
		min-width: 0;
		padding: 0 1rem 0 0;
	}

	.body {
		text-overflow: ellipsis;
		overflow: clip;
		margin-left: -0.625rem;
		padding: 0.625rem;
	}

	.name {
		color: #fff;
		filter: drop-shadow(0 0 4px #000)
			drop-shadow(0 0 0.1px rgba(0, 0, 0, 0.5));
		font-weight: bold;
	}

	.username {
		color: #fff;
		filter: drop-shadow(0 0 4px #000)
			drop-shadow(0 0 0.1px rgba(0, 0, 0, 0.5));
		font-weight: normal;
	}
}
</style>
