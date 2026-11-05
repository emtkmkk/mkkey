<template>
	<span
		v-if="disableLink"
		v-user-preview="disablePreview ? undefined : user.id"
		class="eiwwqkts _noSelect"
		:class="{
			cat: allowCat && user.isCat,
			square: allowCat && user.isCat ? false : $store.state.squareAvatars,
		}"
		:style="{ color }"
		:title="acct(user)"
		@click="onClick"
	>
                <img
                        v-if="
                                !errorIcon
                        "
                        class="inner"
                        :src="hiddenIconUrl ?? displayUrl ?? undefined"
                        @load="handleAvatarLoad"
                        @error="handleAvatarError"
                        decoding="async"
                />
		<img
			v-else
			class="inner"
			src="/static-assets/user-unknown.png"
			decoding="async"
		/>
		<MkUserOnlineIndicator
			v-if="showIndicator && user.onlineStatus !== 'unknown'"
			class="indicator"
			:user="user"
		/>
	</span>
	<MkA
		v-else
		v-user-preview="disablePreview ? undefined : user.id"
		class="eiwwqkts _noSelect"
		:class="{
			cat: allowCat && user.isCat,
			square: allowCat && user.isCat ? false : $store.state.squareAvatars,
		}"
		:style="{ color }"
		:to="userPage(user)"
		:title="acct(user)"
		:target="target"
		@click.stop="showAvatar"
	>
                <img
                        v-if="
                                !errorIcon
                        "
                        class="inner"
                        :src="hiddenIconUrl ?? displayUrl ?? undefined"
                        @load="handleAvatarLoad"
                        @error="handleAvatarError"
                        decoding="async"
                />
		<img
			v-else-if="!errorAltIcon"
			class="inner"
			:src="`${config.url}/avatar-alt/@${acct(user)}`"
			@error="errorAltIcon = true"
			decoding="async"
		/>
		<img
			v-else
			class="inner"
			src="/static-assets/user-unknown.png"
			decoding="async"
		/>
		<MkUserOnlineIndicator
			v-if="showIndicator && user.onlineStatus !== 'unknown'"
			class="indicator"
			:user="user"
		/>
	</MkA>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ユーザーアイコンを表示するコンポーネント
 *
 * @remarks
 * リモートユーザーのアイコンは外部メディアプロキシ経由で読み込む。
 * 読み込みに失敗したり、エラー画像が返ってきたりしたときは、候補（{@link candidates}）を順に試す。
 * すべて失敗したら代わりの画像を表示する。
 *
 * クリックで拡大するときは、いま表示できている URL を開く。
 *
 * @see {@link ../../scripts/media-proxy-fallback.ts}
 * @public
 */
import { watch } from "vue";
import * as misskey from "calckey-js";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { getProxiedImageUrl } from "@/scripts/media-proxy";
import {
	getMediaFallbackUrls,
	isProxyErrorImage,
} from "@/scripts/media-proxy-fallback";
import { extractAvgColorFromBlurhash } from "@/scripts/extract-avg-color-from-blurhash";
import { acct, userPage } from "@/filters/user";
import MkUserOnlineIndicator from "@/components/MkUserOnlineIndicator.vue";
import { defaultStore } from "@/store";
import { openImageViewer } from "@/scripts/open-image-viewer";
import * as config from "@/config";

const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
		target?: string | null;
		disableLink?: boolean;
		disablePreview?: boolean;
		showIndicator?: boolean;
		allowCat?: boolean;
		clickToJumpAvatarImage?: boolean;
	}>(),
	{
		target: null,
		disableLink: false,
		disablePreview: false,
		showIndicator: false,
		allowCat: true,
		clickToJumpAvatarImage: false,
	}
);

const emit = defineEmits<{
	(ev: "click", v: MouseEvent): void;
}>();

const url = $computed(() =>
        defaultStore.state.disableShowingAnimatedImages
                ? getStaticImageUrl(props.user.avatarUrl)
                : props.user.avatarUrl
);
const proxiedUrl = $computed(() =>
        props.user.host ? getProxiedImageUrl(props.user.avatarUrl) : null,
);
const hiddenIconUrl = $computed(() =>
        defaultStore.state.hiddenIconUserIds?.includes(props.user.id)
                ? `${config.url}/avatar-alt/@${acct(props.user)}`
                : null,
);

/**
 * 試す URL の一覧（先頭が元の URL、以降は失敗時の代わり）
 *
 * @remarks
 * 外部プロキシの URL なら、別のプロキシ → このサーバの `/proxy` の順に試す。
 * それ以外のリモート画像は、このサーバの `/proxy` を通して読み直す。
 *
 * NB: 外部プロキシの URL を {@link getProxiedImageUrl} に渡してはいけない。
 * サーバが失敗したプロキシをもう一度呼ぶだけになり、元の画像へたどり着けない。
 *
 * @internal
 */
const candidates = $computed(() => {
	const fallbacks = getMediaFallbackUrls(url);
	if (fallbacks.length > 0) return [url, ...fallbacks];
	return proxiedUrl != null && proxiedUrl !== url ? [url, proxiedUrl] : [url];
});

/**
 * いま表示している URL が {@link candidates} の何番目か
 *
 * @internal
 */
let attempt = $ref(0);

/**
 * いま表示している URL
 *
 * @internal
 */
const displayUrl = $computed(() => candidates[attempt] ?? url);

async function openAvatarImage() {
	const targetUrl = displayUrl ?? url;
	if (!targetUrl) return;

	if (defaultStore.state.imageNewTab) {
		window.open(targetUrl);
		return;
	}

	await openImageViewer(targetUrl);
}

function onClick(ev: MouseEvent) {
        if (props.clickToJumpAvatarImage) openAvatarImage();
        emit("click", ev);
}

function showAvatar(ev: MouseEvent) {
        if (props.clickToJumpAvatarImage) openAvatarImage();
}

let color = $ref();
let errorIcon = $ref(false);
let errorAltIcon = $ref(false);

watch(
        () => url,
        () => {
                attempt = 0;
                errorIcon = false;
                errorAltIcon = false;
        },
);

/**
 * アイコンの読み込みに失敗したとき、次の候補へ進める
 *
 * @remarks
 * 候補が尽きたとき、または隠しているアイコン（`hiddenIconUrl`）の失敗なら、代わりの画像にする。
 *
 * @internal
 */
function handleAvatarError() {
        if (hiddenIconUrl == null && attempt < candidates.length - 1) {
                attempt++;
                return;
        }

        errorIcon = true;
}

/**
 * アイコンが読み込めたとき
 *
 * @remarks
 * 外部プロキシはエラー時にもエラー画像を「成功」として返すことがある。
 * その場合は読み込み失敗と同じ扱いにする。
 *
 * @param ev - load イベント
 * @internal
 */
async function handleAvatarLoad(ev: Event) {
        const src = displayUrl;
        if (!(await isProxyErrorImage(ev.target as HTMLImageElement))) return;
        // 判定の間に別の URL へ変わっていたら何もしない
        if (src !== displayUrl) return;
        handleAvatarError();
}

watch(
	() => props.user.avatarBlurhash,
	() => {
		color = extractAvgColorFromBlurhash(props.user.avatarBlurhash);
	},
	{
		immediate: true,
	}
);
</script>

<style lang="scss" scoped>
@keyframes earwiggleleft {
	from {
		transform: rotate(37.6deg) skew(30deg);
	}
	25% {
		transform: rotate(10deg) skew(30deg);
	}
	50% {
		transform: rotate(20deg) skew(30deg);
	}
	75% {
		transform: rotate(0deg) skew(30deg);
	}
	to {
		transform: rotate(37.6deg) skew(30deg);
	}
}

@keyframes earwiggleright {
	from {
		transform: rotate(-37.6deg) skew(-30deg);
	}
	30% {
		transform: rotate(-10deg) skew(-30deg);
	}
	55% {
		transform: rotate(-20deg) skew(-30deg);
	}
	75% {
		transform: rotate(0deg) skew(-30deg);
	}
	to {
		transform: rotate(-37.6deg) skew(-30deg);
	}
}

.eiwwqkts {
	position: relative;
	display: inline-block;
	vertical-align: bottom;
	flex-shrink: 0;
	border-radius: 100%;
	line-height: 1rem;

	> .inner {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		top: 0;
		border-radius: 100%;
		z-index: 1;
		overflow: hidden;
		object-fit: cover;
		width: 100%;
		height: 100%;
	}

	> .indicator {
		position: absolute;
		z-index: 1;
		bottom: 0;
		left: 0;
		width: 18%;
		height: 18%;
	}

	&.square {
		border-radius: 20%;

		> .inner {
			border-radius: 20%;
		}
	}

	&.cat {
		&:before,
		&:after {
			background: #ebbcba;
			border: solid 0.25rem currentColor;
			box-sizing: border-box;
			content: "";
			display: inline-block;
			height: 50%;
			width: 50%;
		}

		&:before {
			border-radius: 0 75% 75%;
			transform: rotate(37.5deg) skew(30deg);
		}

		&:after {
			border-radius: 75% 0 75% 75%;
			transform: rotate(-37.5deg) skew(-30deg);
		}

		&:hover {
			&:before {
				animation: earwiggleleft 1s infinite;
			}

			&:after {
				animation: earwiggleright 1s infinite;
			}
		}
	}
}
</style>
