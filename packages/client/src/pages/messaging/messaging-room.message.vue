<template>
	<div v-size="{ max: [400, 500] }" class="thvuemwp" :class="{ isMe }">
		<MkAvatar
			v-if="!isMe"
			class="avatar"
			:user="message.user"
			:show-indicator="true"
		/>
		<div class="content">
			<div class="balloon" :class="{ noText: message.text == null }">
				<button
					v-if="isMe"
					class="delete-button"
					:title="i18n.ts.delete"
					@click="del"
				>
					<img src="/client-assets/remove.png" alt="Delete" />
				</button>
				<div v-if="!message.isDeleted" class="content">
					<Mfm
						v-if="message.text"
						ref="text"
						class="text"
						:text="message.text"
						:i="$i"
					/>
				</div>
				<div v-else class="content">
					<p class="is-deleted">{{ i18n.ts.deletedChat }}</p>
				</div>
			</div>
			<div v-if="message.file" class="file" width="25rem">
				<XMediaList
					v-if="
						message.file.type.split('/')[0] == 'image' ||
						message.file.type.split('/')[0] == 'video'
					"
					:in-dm="true"
					width="25rem"
					:media-list="[message.file]"
					style="border-radius: 0.3125rem"
				/>
				<a
					v-else
					:href="message.file.url"
					rel="noopener"
					target="_blank"
					:title="message.file.name"
				>
					<p>{{ message.file.name }}</p>
				</a>
			</div>
			<div></div>
			<MkUrlPreview
				v-for="url in urls"
				:key="url"
				:url="url"
				style="margin: 0.5rem 0"
			/>
			<footer>
				<template v-if="isGroup">
					<span v-if="message.reads.length > 0" class="read"
						>{{ i18n.ts.messageRead }}
						{{ message.reads.length }}</span
					>
				</template>
				<template v-else>
					<span v-if="isMe && message.isRead" class="read">{{
						i18n.ts.messageRead
					}}</span>
				</template>
				<MkTime :time="message.createdAt" />
				<template v-if="message.is_edited"
					><i class="ph-pencil ph-bold ph-lg"></i
				></template>
			</footer>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as mfm from "mfm-js";
import type * as Misskey from "calckey-js";
import XMediaList from "@/components/MkMediaList.vue";
import { extractUrlFromMfm } from "@/scripts/extract-url-from-mfm";
import MkUrlPreview from "@/components/MkUrlPreview.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";

const props = defineProps<{
	message: Misskey.entities.MessagingMessage;
	isGroup?: boolean;
}>();

const isMe = $computed(() => props.message.userId === $i?.id);
const urls = $computed(() =>
	props.message.text ? extractUrlFromMfm(mfm.parse(props.message.text)) : []
);

function del(): void {
	os.api("messaging/messages/delete", {
		messageId: props.message.id,
	});
}
</script>

<style lang="scss" scoped>
.thvuemwp {
	$me-balloon-color: var(--accent);
	--plyr-color-main: var(--accent);

	position: relative;
	background-color: transparent;
	display: flex;

	> .avatar {
		position: sticky;
		top: calc(var(--stickyTop, 0) + 1.25rem);
		display: block;
		width: 2.8125rem;
		height: 2.8125rem;
		transition: all 0.1s ease;
	}

	> .content {
		min-width: 0;

		> .balloon {
			position: relative;
			display: inline-flex;
			align-items: center;
			padding: 0;
			min-height: 2.375rem;
			border-radius: 1rem;
			max-width: 100%;

			& + * {
				clear: both;
			}

			&:hover {
				> .delete-button {
					display: block;
				}
			}

			> .delete-button {
				display: none;
				position: absolute;
				z-index: 1;
				top: -0.25rem;
				right: -0.25rem;
				margin: 0;
				padding: 0;
				cursor: pointer;
				outline: none;
				border: none;
				border-radius: 0;
				box-shadow: none;
				background: transparent;

				> img {
					vertical-align: bottom;
					width: 1rem;
					height: 1rem;
					cursor: pointer;
				}
			}

			> .content {
				max-width: 100%;
				object-fit: contain;

				> .is-deleted {
					display: block;
					margin: 0;
					padding: 0;
					overflow: hidden;
					overflow-wrap: break-word;
					font-size: 1em;
					color: rgba(#000, 0.5);
				}

				> .text {
					display: block;
					margin: 0;
					padding: 0.75rem 1.125rem;
					overflow: hidden;
					overflow-wrap: break-word;
					word-break: break-word;
					font-size: 1em;
					color: rgba(#000, 0.8);

					& + .file {
						> a {
							border-radius: 0 0 1rem 1rem;
						}
					}
				}

				> .file {
					> a {
						display: block;
						max-width: 100%;
						border-radius: 1rem;
						overflow: hidden;
						text-decoration: none;

						&:hover {
							text-decoration: none;

							> p {
								background: #ccc;
							}
						}

						> * {
							display: block;
							margin: 0;
							width: 100%;
							max-height: 32rem;
							object-fit: contain;
							box-sizing: border-box;
						}

						> p {
							padding: 1.875rem;
							text-align: center;
							color: #6e6a86;
							background: #ddd;
						}
					}
				}
			}
		}

		> footer {
			display: block;
			margin: 0.125rem 0 0 0;
			font-size: 0.65em;

			> .read {
				margin: 0 0.5rem;
			}

			> i {
				margin-left: 0.25rem;
			}
		}
	}

	&:not(.isMe) {
		padding-left: var(--margin);

		> .content {
			padding-left: 1rem;
			padding-right: 2rem;

			> .balloon {
				$color: var(--X4);
				background: $color;

				&.noText {
					background: transparent;
				}

				&:not(.noText):before {
					left: -0.875rem;
					border-top: solid 0.5rem transparent;
					border-right: solid 0.5rem $color;
					border-bottom: solid 0.5rem transparent;
					border-left: solid 0.5rem transparent;
				}

				> .content {
					> .text {
						color: var(--fg);
					}
				}
			}

			> footer {
				text-align: left;
			}
		}
	}

	&.isMe {
		flex-direction: row-reverse;
		padding-right: var(--margin);
		right: var(--margin); // 削除時にposition: absoluteになったときに使う

		> .content {
			padding-right: 1rem;
			padding-left: 2rem;
			text-align: right;

			> .balloon {
				background: $me-balloon-color;
				text-align: left;

				::selection {
					color: var(--accent);
					background-color: #fff;
				}

				&.noText {
					background: transparent;
				}

				&:not(.noText):before {
					right: -0.875rem;
					left: auto;
					border-top: solid 0.5rem transparent;
					border-right: solid 0.5rem transparent;
					border-bottom: solid 0.5rem transparent;
					border-left: solid 0.5rem $me-balloon-color;
				}

				> .content {
					> p.is-deleted {
						color: rgba(#fff, 0.5);
					}

					> .text {
						&,
						::v-deep(*) {
							color: var(--fgOnAccent) !important;
						}
					}
				}
			}

			> footer {
				text-align: right;

				> .read {
					user-select: none;
				}
			}
		}
	}

	&.max-width_400px {
		> .avatar {
			width: 3rem;
			height: 3rem;
		}

		> .content {
			> .balloon {
				> .content {
					> .text {
						font-size: 0.9em;
					}
				}
			}
		}
	}

	&.max-width_500px {
		> .content {
			> .balloon {
				> .content {
					> .text {
						padding: 0.5rem 1rem;
					}
				}
			}
		}
	}
}
</style>
