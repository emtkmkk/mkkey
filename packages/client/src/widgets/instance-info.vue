<template>
	<div class="_panel mkw-instanceInfo">
		<div
			class="container"
			:style="{
				backgroundImage: backgroundUrl
					? `url(${backgroundUrl})`
					: undefined,
			}"
		>
			<div class="iconContainer">
				<img
					:src="instance.iconUrl ?? '/favicon.ico'"
					alt=""
					class="icon"
				/>
			</div>
			<div class="bodyContainer">
				<div class="body">
					<MkA class="name" to="/about">{{ instance.name }}</MkA>
					<div class="host">{{ host }}</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * インスタンスのアイコン・名前・ホスト名を表示するウィジェット。
 *
 * @remarks
 * - 背景は bannerUrl または backgroundImageUrl を優先して使用する
 * - 設定項目は本家 Misskey と同様に無し
 *
 * @public
 */
import { computed } from "vue";
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentExpose,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import { host } from "@/config";
import { instance } from "@/instance";

// #region ウィジェット定義

const name = "instanceInfo";

/** 設定項目なし（本家 WidgetInstanceInfo と同様） */
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

/** バナーまたは背景画像 URL（あれば背景に使用） */
const backgroundUrl = computed(
	() => instance.bannerUrl ?? instance.backgroundImageUrl ?? null,
);

// #endregion

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.mkw-instanceInfo {
	.container {
		position: relative;
		background-size: cover;
		background-position: center;
		display: flex;
	}

	.iconContainer {
		display: inline-block;
		text-align: center;
		padding: 1rem;
	}

	.icon {
		display: inline-block;
		width: 3.75rem;
		height: 3.75rem;
		border-radius: 0.5rem;
		box-sizing: border-box;
		border: solid 3px #fff;
		object-fit: cover;
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

	.host {
		color: #fff;
		filter: drop-shadow(0 0 4px #000)
			drop-shadow(0 0 0.1px rgba(0, 0, 0, 0.5));
	}
}
</style>
