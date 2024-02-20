<template>
	<template v-if="page">
		<MkA
			:to="`/@${page.user.username}/pages/${page.name}`"
			class="vhpxefrj _block"
			tabindex="-1"
			:behavior="`${ui === 'deck' ? 'window' : null}`"
		>
			<div
				v-if="page.eyeCatchingImage"
				class="thumbnail"
				:style="`background-image: url('${page.eyeCatchingImage.thumbnailUrl}')`"
			></div>
			<article>
				<header>
					<h1 :title="page.title">{{ page.title }}</h1>
				</header>
				<p v-if="page.summary" :title="page.summary">
					{{
						page.summary.length > 85
							? `${page.summary.slice(0, 85)}…`
							: page.summary
					}}
				</p>
				<footer>
					<img
						class="icon"
						:src="page.user.avatarUrl"
						aria-label="none"
					/>
					<p>{{ userName(page.user) }}</p>
				</footer>
			</article>
		</MkA>
	</template>
</template>

<script lang="ts" setup>
import { userName } from "@/filters/user";
import { ui } from "@/config";

defineProps<{
	page: any;
}>();
</script>

<style lang="scss" scoped>
.vhpxefrj {
	display: block;

	&:hover {
		text-decoration: none;
		color: var(--accent);
	}

	> .thumbnail {
		width: 100%;
		height: 12.5rem;
		background-position: center;
		background-size: cover;
		display: flex;
		justify-content: center;
		align-items: center;

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

	> article {
		padding: 1rem;

		> header {
			margin-bottom: 0.5rem;

			> h1 {
				margin: 0;
				font-size: 1em;
				color: var(--urlPreviewTitle);
			}
		}

		> p {
			margin: 0;
			color: var(--urlPreviewText);
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

	@media (max-width: 43.75rem) {
		> .thumbnail {
			position: relative;
			width: 100%;
			height: 6.25rem;

			& + article {
				left: 0;
				width: 100%;
			}
		}
	}

	@media (max-width: 34.375rem) {
		font-size: 0.75rem;

		> .thumbnail {
			height: 5rem;
		}

		> article {
			padding: 0.75rem;
		}
	}

	@media (max-width: 31.25rem) {
		font-size: 0.625rem;

		> .thumbnail {
			height: 4.375rem;
		}

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
	}
}
</style>
