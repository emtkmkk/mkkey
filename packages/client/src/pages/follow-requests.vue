<template>
	<MkStickyContainer>
		<template #header><MkPageHeader /></template>
		<MkSpacer :content-max="800">
			<MkPagination ref="paginationComponent" :pagination="pagination">
				<template #empty>
					<div class="_fullinfo">
						<img
							src="/static-assets/badges/info.png"
							class="_ghost"
						/>
						<div>{{ i18n.ts.noFollowRequests }}</div>
					</div>
				</template>
				<template #default="{ items }">
					<div class="mk-follow-requests">
						<div
							v-for="req in items"
							:key="req.id"
							class="request _panel"
						>
							<div class="head">
								<MkAvatar
									class="avatar"
									:user="req.follower"
									:show-indicator="true"
									disableLink
								/>
								<div class="who">
									<MkA
										v-user-preview="req.follower.id"
										class="name"
										:to="userPage(req.follower)"
										><MkUserName :user="req.follower"
									/></MkA>
									<p class="acct">
										@{{ acct(req.follower) }}
									</p>
									<div class="meta">
										<span
											v-if="req.follower.instance"
											class="instance"
											:title="req.follower.instance.host"
										>
											<img
												v-if="instanceIcon(req.follower.instance)"
												class="instance-icon"
												:src="instanceIcon(req.follower.instance)"
												alt=""
											/>
											<span class="instance-name">{{
												req.follower.instance.name ||
												req.follower.instance.host
											}}</span>
										</span>
										<span
											class="requested"
											:title="i18n.ts.followRequestedAt"
										>
											<i class="ph-clock ph-bold"></i>
											<MkTime :time="req.createdAt" />
										</span>
									</div>
									<div
										v-if="
											req.follower.isFollowing ||
											req.follower.isBot
										"
										class="badges"
									>
										<span
											v-if="req.follower.isFollowing"
											class="badge following"
											><i
												class="ph-check-circle ph-bold"
											></i>
											{{ i18n.ts.youFollowThisUser }}</span
										>
										<span
											v-if="req.follower.isBot"
											class="badge"
											><i class="ph-robot ph-bold"></i>
											Bot</span
										>
									</div>
								</div>
							</div>

							<div class="description">
								<Mfm
									v-if="req.follower.description"
									:text="req.follower.description"
									:is-note="false"
									:author="req.follower"
									:i="$i"
									:custom-emojis="req.follower.emojis"
									:plain="true"
								/>
								<span v-else class="empty">{{
									i18n.ts.noAccountDescription
								}}</span>
							</div>

							<dl class="stats">
								<div>
									<dt>{{ i18n.ts.registeredDate }}</dt>
									<dd>
										<MkTime
											:time="req.follower.createdAt"
											mode="absolute"
											date-only
										/>
									</dd>
								</div>
								<div>
									<dt>{{ i18n.ts.notes }}</dt>
									<dd>{{ formatCount(req.follower.notesCount) }}</dd>
								</div>
								<div>
									<dt>{{ i18n.ts.following }}</dt>
									<dd>
										{{ formatCount(req.follower.followingCount) }}
									</dd>
								</div>
								<div>
									<dt>{{ i18n.ts.followers }}</dt>
									<dd>
										{{ formatCount(req.follower.followersCount) }}
									</dd>
								</div>
							</dl>

							<div class="actions">
								<MkButton
									inline
									rounded
									primary
									@click="accept(req.follower)"
								>
									<i class="ph-check ph-bold"></i>
									{{ i18n.ts.accept }}
								</MkButton>
								<MkButton
									inline
									rounded
									@click="reject(req.follower)"
								>
									<i class="ph-x ph-bold"></i>
									{{ i18n.ts.reject }}
								</MkButton>
								<MkButton
									inline
									rounded
									@click="ignore(req.follower)"
								>
									<i class="ph-bell-slash ph-bold"></i>
									{{ i18n.ts.ignore }}
								</MkButton>
							</div>
						</div>
					</div>
				</template>
			</MkPagination>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 受けたフォロー申請の一覧ページ。
 *
 * @remarks
 * - 許可するかを判断しやすいよう、申請日時・自己紹介・登録日・投稿数・フォロー数・
 *   フォロワー数・「自分がフォロー中か」を出す。申請者は API が詳細版で返す。
 * - フォロー数・フォロワー数は、相手が非公開にしていると数値でなく "N/A" が返るので「-」と出す。
 * - 新しい申請から順に 10 件ずつページ送りする（API 側で sinceId / untilId に対応済み）。
 * - 申請日時とサーバー（アイコンと名前）は、名前の下の行にまとめる。以前は申請日時を右の列に、
 *   サーバーを MkInstanceTicker で別の行に出していたが、スマホの幅だと名前が窮屈になり、
 *   MkInstanceTicker はこの場所ではサーバー名を隠す作りなので、アイコンだけが 1 行に出ていた。
 * - スマホの幅では、3 つのボタンを同じ幅で 1 行に並べる（右寄せのまま折り返すと 2 つと 1 つに分かれるため）。
 * - NB: リモートのユーザーの「登録日」は、このサーバーが初めてそのユーザーを知った日。
 *   相手のサーバーでの本当の登録日ではない（ユーザーページの表示と同じ）。
 *
 * @see {@link server/api/endpoints/following/requests/list} 申請一覧 API
 * @internal
 */
import { ref, computed } from "vue";
import MkPagination from "@/components/MkPagination.vue";
import MkButton from "@/components/MkButton.vue";
import { getProxiedImageUrlNullable } from "@/scripts/media-proxy";
import { userPage, acct } from "@/filters/user";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

/**
 * 一覧の再読み込みに使うページ送り部品への参照。
 *
 * @internal
 */
const paginationComponent = ref<InstanceType<typeof MkPagination>>();

/**
 * 申請一覧の取得設定。
 *
 * @internal
 */
const pagination = {
	endpoint: "following/requests/list" as const,
	limit: 10,
};

/**
 * 申請者のサーバーのアイコン（ファビコンを優先）を、メディアプロキシ経由の URL にする。
 *
 * @param instance - 申請者のサーバーの情報
 * @returns 画像の URL。無ければ null
 *
 * @internal
 */
function instanceIcon(instance: {
	faviconUrl?: string | null;
	iconUrl?: string | null;
}): string | null {
	return getProxiedImageUrlNullable(
		instance.faviconUrl ?? instance.iconUrl,
		"preview",
	);
}

/**
 * 件数を表示用の文字にする。
 *
 * @param value - API が返した件数（非公開なら "N/A" などの文字が来る）
 * @returns 3 桁区切りの数字か、数でなければ「-」
 *
 * @internal
 */
function formatCount(value: unknown): string {
	return typeof value === "number" ? value.toLocaleString() : "-";
}

/**
 * 申請を許可する。
 *
 * @param user - 申請してきたユーザー
 * @returns 確認ダイアログと API 呼び出しの完了
 * @internal
 */
async function accept(user) {
	const { canceled } = await os.confirm({
		type: "question",
		text: i18n.t("acceptConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("following/requests/accept", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

/**
 * 申請を拒否する。
 *
 * @param user - 申請してきたユーザー
 * @returns 確認ダイアログと API 呼び出しの完了
 * @internal
 */
async function reject(user) {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("rejectConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("following/requests/reject", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

/**
 * 以降この相手からの申請を無視する（follow 範囲のミュート）。
 *
 * @param user - 申請してきたユーザー
 * @returns 確認ダイアログと API 呼び出しの完了
 * @internal
 */
async function ignore(user) {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("ignoreConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("follow-blocking/create", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() => ({
		title: i18n.ts.followRequests,
		icon: "ph-hand-waving ph-bold ph-lg",
	}))
);
</script>

<style lang="scss" scoped>
.mk-follow-requests {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;

	> .request {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;

		> .head {
			display: flex;
			align-items: flex-start;
			gap: 0.75rem;

			> .avatar {
				flex-shrink: 0;
				width: 3rem;
				height: 3rem;
				border-radius: 0.5rem;
			}

			> .who {
				flex: 1;
				min-width: 0;

				> .name,
				> .acct {
					display: block;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					margin: 0;
				}

				> .name {
					font-size: 1rem;
					font-weight: bold;
					line-height: 1.5rem;
				}

				> .acct {
					font-size: 0.875rem;
					line-height: 1.25rem;
					opacity: 0.7;
				}

				// サーバーと申請日時の行。狭いときはサーバー名を省略し、申請日時は必ず見せる
				> .meta {
					display: flex;
					align-items: center;
					gap: 0.25rem 0.75rem;
					margin-top: 0.25rem;
					font-size: 0.8125rem;
					line-height: 1.25rem;
					min-width: 0;

					> .instance {
						display: inline-flex;
						align-items: center;
						gap: 0.25rem;
						min-width: 0;
						opacity: 0.8;

						> .instance-icon {
							flex-shrink: 0;
							width: 1em;
							height: 1em;
							border-radius: 0.2rem;
							object-fit: contain;
						}

						> .instance-name {
							white-space: nowrap;
							overflow: hidden;
							text-overflow: ellipsis;
						}
					}

					> .requested {
						flex-shrink: 0;
						white-space: nowrap;
						opacity: 0.7;

						> i {
							margin-right: 0.25rem;
						}
					}
				}

				> .badges {
					display: flex;
					flex-wrap: wrap;
					gap: 0.375rem;
					margin-top: 0.375rem;

					> .badge {
						font-size: 0.75rem;
						line-height: 1.25rem;
						padding: 0 0.5rem;
						border-radius: 999px;
						background: var(--buttonBg);

						&.following {
							color: var(--accent);
						}
					}
				}
			}

		}

		> .description {
			font-size: 0.875rem;
			line-height: 1.5;
			// 長い自己紹介で一覧が縦に伸びすぎないよう 3 行で切る
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
			overflow: hidden;
			overflow-wrap: anywhere;

			> .empty {
				opacity: 0.5;
			}
		}

		> .stats {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 0.5rem;
			margin: 0;
			padding: 0.625rem 0;
			border-top: solid 0.5px var(--divider);
			border-bottom: solid 0.5px var(--divider);

			@media (max-width: 31.25rem) {
				grid-template-columns: repeat(2, 1fr);
			}

			> div {
				text-align: center;
				min-width: 0;

				> dt {
					font-size: 0.75rem;
					opacity: 0.7;
				}

				> dd {
					margin: 0;
					font-weight: bold;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}
		}

		> .actions {
			display: flex;
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 0.5rem;

			// スマホの幅では 3 つを同じ幅で 1 行に並べる
			@media (max-width: 31.25rem) {
				display: grid;
				grid-template-columns: repeat(3, 1fr);

				> * {
					min-width: 0;
					padding-left: 0.5rem;
					padding-right: 0.5rem;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}

			i {
				margin-right: 0.25rem;
			}
		}
	}
}
</style>
