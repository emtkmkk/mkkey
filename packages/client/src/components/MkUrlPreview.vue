<template>
	<div
		v-if="playerEnabled"
		class="player"
		:style="`padding: ${
			((player.height || 0) / (player.width || 1)) * 100
		}% 0 0`"
		@click.stop
	>
		<button
			class="disablePlayer"
			:title="i18n.ts.disablePlayer"
			@click="playerEnabled = false"
		>
			<i class="ph-x ph-bold ph-lg"></i>
		</button>
		<iframe
			:src="
				player.url +
				(player.url.match(/\?/)
					? '&autoplay=1&auto_play=1'
					: '?autoplay=1&auto_play=1')
			"
			:width="player.width || '100%'"
			:heigth="player.height || 250"
			frameborder="0"
			allow="autoplay; encrypted-media"
			allowfullscreen
		/>
	</div>
	<div
		v-else-if="tweetId && tweetExpanded"
		ref="twitter"
		class="twitter"
		@click.stop
	>
		<iframe
			ref="tweet"
			allow="fullscreen;web-share"
			sandbox="allow-popups allow-scripts allow-same-origin"
			scrolling="no"
			frameborder="no"
			:style="{
				position: 'relative',
				width: '100%',
				height: `${tweetHeight}px`,
			}"
			:src="`https://platform.twitter.com/embed/index.html?embedId=${embedId}&amp;hideCard=false&amp;hideThread=false&amp;lang=en&amp;theme=${
				$store.state.darkMode ? 'dark' : 'light'
			}&amp;id=${tweetId}`"
		></iframe>
	</div>
	<div
		v-else
		v-size="{ max: [400, 350] }"
		class="mk-url-preview"
		:class="{ legacyStyle: $store.state.compactGridUrl }"
		@click.stop
	>
		<MkButton
			v-if="tweetId"
			:small="true"
			class="expandTweet"
			@click="tweetExpanded = true"
		>
			{{ i18n.ts.expandTweet }}
		</MkButton>
		<MkButton
			v-if="
				thumbnail && $store.state.enableDataSaverMode && !showThumbnail
			"
			class="showThumbnail"
			:small="true"
			@click="showThumbnail = true"
		>
			<i class="ph-image ph-bold ph-lg"></i> {{ i18n.ts.showThumbnail }}
		</MkButton>
		<transition :name="$store.state.animation ? 'zoom' : ''" mode="out-in">
			<component
				:is="self ? 'MkA' : 'a'"
				v-if="!fetching"
				class="link"
				:class="{ compact }"
				:[attr]="self ? url.substr(local.length) : url"
				rel="nofollow noopener"
				:target="target"
				:title="url"
			>
				<div
					v-if="
						thumbnail &&
						(!defaultStore.state.enableDataSaverMode ||
							showThumbnail)
					"
					class="thumbnail"
					:style="`background-image: url('${thumbnail}')`"
				>
					<button
						v-if="!playerEnabled && player.url"
						class="_button"
						:title="i18n.ts.enablePlayer"
						@click.prevent="playerEnabled = true"
					>
						<i class="ph-play-circle ph-bold ph-7x"></i>
					</button>
				</div>
				<article>
					<header>
						<h1 :title="title">{{ title }}</h1>
					</header>
					<p v-if="description" :title="description">
						{{
							description.length > 85
								? `${description.slice(0, 85)}…`
								: description
						}}
					</p>
					<footer>
						<img
							v-if="icon"
							class="icon"
							:src="icon"
							@error="icon = ''"
						/>
						<p :title="sitename">{{ sitename }}</p>
					</footer>
				</article>
			</component>
		</transition>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted } from "vue";
import { url as local, lang } from "@/config";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import MkButton from "@/components/MkButton.vue";

const props = withDefaults(
	defineProps<{
		url: string;
		detail?: boolean;
		compact?: boolean;
	}>(),
	{
		detail: false,
		compact: false,
	}
);

const self = props.url.startsWith(local);
const attr = self ? "to" : "href";
const target = self ? null : "_blank";
let fetching = $ref(true);
let title = $ref<string | null>(null);
let description = $ref<string | null>(null);
let thumbnail = $ref<string | null>(null);
let icon = $ref<string | null>(null);
let sitename = $ref<string | null>(null);
let player = $ref({
	url: null,
	width: null,
	height: null,
});
let playerEnabled = $ref(false);
let showThumbnail = $ref(false);
let tweetId = $ref<string | null>(null);
let tweetExpanded = $ref(defaultStore.state.alwaysXExpand || props.detail);
const embedId = `embed${Math.random().toString().replace(/\D/, "")}`;
let tweetHeight = $ref(150);

const requestUrl = new URL(props.url);
if (!["http:", "https:"].includes(requestUrl.protocol))
	throw new Error("invalid url");

if (
	requestUrl.hostname === "twitter.com" ||
	requestUrl.hostname === "mobile.twitter.com" ||
	requestUrl.hostname === "x.com" ||
	requestUrl.hostname === "mobile.x.com"
) {
	const m = requestUrl.pathname.match(/^\/.+\/status(?:es)?\/(\d+)/);
	if (m) tweetId = m[1];
}

if (
	requestUrl.hostname === "music.youtube.com" &&
	requestUrl.pathname.match("^/(?:watch|channel)")
) {
	requestUrl.hostname = "www.youtube.com";
}

const requestLang = (lang || "ja-JP")
	.replace("ja-KS", "ja-JP")
	.replace("ja-KK", "ja-JP");

requestUrl.hash = "";

fetch(
	`/url?url=${encodeURIComponent(requestUrl.href)}&lang=${requestLang}`
).then((res) => {
	res.json().then((info) => {
		if (info.url == null) return;
		title = info.title;
		description = info.description;
		thumbnail = info.thumbnail;
		icon = info.icon;
		sitename = info.sitename;
		fetching = false;
		player = info.player;
	});
});

function adjustTweetHeight(message: any) {
	if (message.origin !== "https://platform.twitter.com") return;
	const embed = message.data?.["twttr.embed"];
	if (embed?.method !== "twttr.private.resize") return;
	if (embed?.id !== embedId) return;
	const height = embed?.params[0]?.height;
	if (height) tweetHeight = height;
}

(window as any).addEventListener("message", adjustTweetHeight);

onUnmounted(() => {
	(window as any).removeEventListener("message", adjustTweetHeight);
});
</script>

<style lang="scss" scoped>
.player {
	position: relative;
	width: 100%;

	> button {
		position: absolute;
		top: -1.5em;
		right: 0;
		font-size: 1em;
		width: 1.5em;
		height: 1.5em;
		padding: 0;
		margin: 0;
		color: var(--fg);
		background: rgba(128, 128, 128, 0.2);
		opacity: 0.7;

		&:hover {
			opacity: 0.9;
		}
	}

	> iframe {
		height: 100%;
		left: 0;
		position: absolute;
		top: 0;
		width: 100%;
	}
}

.mk-url-preview {
	&.max-width_400px {
		> .link {
			font-size: 0.75rem;

			> .thumbnail {
				/* height: 5rem; */
			}

			> article {
				padding: 0.75rem;
			}
		}
	}

	&.max-width_350px {
		> .link {
			font-size: 0.625rem;

			> article {
				padding: 0.5rem;

				> header {
					margin-bottom: 0.25rem;
				}

				> footer {
					margin-top: 0.25rem;

					> img {
						width: 0.75rem;
						height: 0.75rem;
					}
				}
			}

			&.compact {
				> article {
					padding: 0.25rem;

					> header {
						margin-bottom: 0.125rem;
					}

					> footer {
						margin-top: 0.125rem;
					}
				}
			}
		}
	}

	> .expandTweet {
		margin-top: 0.1875rem;
	}

	> .showThumbnail {
		margin-top: 0.1875rem;
	}

	> .link {
		position: relative;
		display: block;
		font-size: 0.875rem;
		margin-top: 0.1875rem;
		border: 0.0625rem solid var(--divider);
		border-radius: 0.5rem;
		overflow: hidden;
		transition: background 0.2s;
		pointer-events: none;
		&:hover,
		&:focus-within {
			text-decoration: none;
			background-color: var(--panelHighlight);
			> article > header > h1 {
				text-decoration: underline;
			}
		}

		> .thumbnail {
			position: relative;
			width: 100%;
			height: 13em;
			background-position: center;
			background-size: contain;
			background-repeat: no-repeat;
			display: flex;
			justify-content: center;
			align-items: center;
			pointer-events: none;

			> button {
				font-size: 6em;
				opacity: 0.9;
				pointer-events: auto;

				&:hover {
					font-size: 6em;
					opacity: 1;
				}
			}

			& + article {
				left: 0;
				width: 100%;
			}
		}

		> article {
			position: relative;
			box-sizing: border-box;
			padding: 1rem;
			pointer-events: auto;

			> header {
				margin-bottom: 0.5rem;

				> h1 {
					margin: 0;
					font-size: 1em;
				}
			}

			> p {
				margin: 0;
				font-size: 0.8em;
			}

			> footer {
				margin-top: 0.5rem;
				height: 1rem;

				> img {
					display: inline-block;
					width: 1rem;
					height: 1rem;
					margin-right: 0.25rem;
					vertical-align: top;
				}

				> p {
					display: inline-block;
					margin: 0;
					color: var(--urlPreviewInfo);
					font-size: 0.8em;
					line-height: 1rem;
					vertical-align: top;
				}
			}
		}

		&.compact {
			> article {
				> header h1,
				p,
				footer {
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
				}
			}
		}
	}

	&.legacyStyle {
		&.max-width_400px > .link {
			> .thumbnail {
				height: 5rem;
			}
		}

		&.max-width_350px {
			> .link {
				> .thumbnail {
					height: 4.375rem;
				}
				&.compact {
					> .thumbnail {
						position: absolute;
						width: 3.5rem;
						height: 100%;
					}
					> article {
						left: 3.5rem;
						width: calc(100% - 3.5rem);
					}
				}
			}
		}

		> .expandTweet {
			margin-top: 0;
		}

		> .showThumbnail {
			margin-top: 0;
		}

		> .link {
			margin-top: 0;
			pointer-events: auto;
			> .thumbnail {
				position: absolute;
				width: 6.25rem;
				height: 100%;
				background-size: cover;
				pointer-events: auto;

				> button {
					font-size: 3.5em;
					opacity: 0.7;

					&:hover {
						font-size: 4em;
						opacity: 0.9;
					}
				}

				& + article {
					left: 6.25rem;
					width: calc(100% - 6.25rem);
				}
			}
		}
	}
}
</style>
