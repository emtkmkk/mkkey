<template>
	<MkSpacer :content-max="narrow ? 800 : 1100">
		<div
			ref="rootEl"
			v-size="{ max: [500] }"
			class="ftskorzw"
			:class="{ wide: !narrow }"
		>
			<div class="main">
				<!-- TODO -->
				<!-- <div class="punished" v-if="user.isSuspended"><i class="ph-warning ph-bold ph-lg" style="margin-right: 8px;"></i> {{ i18n.ts.userSuspended }}</div> -->
				<!-- <div class="punished" v-if="user.isSilenced"><i class="ph-warning ph-bold ph-lg" style="margin-right: 8px;"></i> {{ i18n.ts.userSilenced }}</div> -->

				<div class="profile">
					<MkMoved
						v-if="user.movedToUri"
						:host="user.movedToUri.host"
						:acct="user.movedToUri.username"
					/>
					<MkRemoteCaution
						v-if="user.host != null"
						:href="user.url"
						class="warn"
					/>

					<div :key="user.id" class="_block main">
						<div class="banner-container" :style="style">
							<div
								ref="bannerEl"
								class="banner"
								:style="style"
							></div>
							<div class="fade"></div>
							<div class="title">
								<div class="nameCollumn">
									<MkUserName
										class="name"
										:user="user"
										:nowrap="false"
										:original="true"
									/>
									<div>
									<span
										v-if="
											$i &&
											$i.id != user.id &&
											user.isFollowed
										"
										class="followed"
										>{{ i18n.ts.followsYou }}</span
									>
									</div>
								</div>
								<div class="bottom">
									<span class="username"
										><MkAcct :user="user" :detail="true"
									/></span>
									<span
									    v-for="badge in mkBadge"
										:key="'badge-' + badge.key"
										style="badge"
										:title="badge.name"
										v-tooltip="badge.name"
										><MkEmoji
											class="emoji"
											:emoji="badge.emoji"
											style="height: 1.3em; pointer-events: none;"
										></MkEmoji
									></span>
									<span
										v-if="user.isAdmin"
										:title="i18n.ts.admin"
										style="color: var(--badge)"
										><i
											class="ph-wrench ph-fill ph-lg"
										></i
									></span>
									<span
										v-if="!user.isAdmin && user.isModerator"
										:title="i18n.ts.moderator"
										style="color: var(--badge)"
										><i
											class="ph-wrench ph-bold"
										></i
									></span>
									<span
										v-if="user.isLocked"
										:title="i18n.ts.isLocked"
										><i class="ph-lock ph-bold ph-lg"></i
									></span>
									<span
										v-if="user.isBot"
										:title="i18n.ts.isBot"
										><i class="ph-robot ph-bold ph-lg"></i
									></span>
								</div>
							</div>
						</div>
						<MkAvatar
							class="avatar"
							:user="user"
							:disable-preview="true"
							:show-indicator="true"
							:click-to-jump-avatar-image="true"
						/>
						<div class="title">
							<div class="nameCollumn">
								<MkUserName
									class="name"
									:user="user"
									:nowrap="false"
									:original="true"
								/>
								<div>
								<span
									v-if="
										$i &&
										$i.id != user.id &&
										user.isFollowed
									"
									class="followed"
									>{{ i18n.ts.followsYou }}</span
								>
								</div>
							</div>
							<div class="bottom">
								<span class="username"
									><MkAcct :user="user" :detail="true"
								/></span>
								<span
									v-for="badge in mkBadge"
									:key="'badge-' + badge.key"
									style="badge"
									:title="badge.name"
									v-tooltip="badge.name"
									><MkEmoji
										class="emoji"
										:emoji="badge.emoji"
										style="height: 1.3em; pointer-events: none;"
									></MkEmoji
								></span>
								<span
									v-if="user.isAdmin"
									:title="i18n.ts.admin"
									style="color: var(--badge)"
									><i
										class="ph-wrench ph-fill ph-lg"
									></i
								></span>
								<span
									v-if="!user.isAdmin && user.isModerator"
									:title="i18n.ts.moderator"
									style="color: var(--badge)"
									><i class="ph-wrench ph-bold"></i
								></span>
								<span
									v-if="user.isLocked"
									:title="i18n.ts.isLocked"
									><i class="ph-lock ph-bold ph-lg"></i
								></span>
								<span v-if="user.isBot" :title="i18n.ts.isBot"
									><i class="ph-robot ph-bold ph-lg"></i
								></span>
							</div>
						</div>
						<div class="follow-container">
							<div class="actions">
								<MkFollowButton
									v-if="$i == null || ($i != null && $i.id != user.id)"
									:user="user"
									@refresh="emit('refresh')"
									:inline="true"
									:transparent="false"
									:full="!narrow"
									class="koudoku"
								/>
								<button class="menu _button" @click="menu">
									<i
										class="ph-dots-three-outline ph-bold ph-lg"
									></i>
								</button>
								<!-- <MkFollowButton v-else-if="$i == null" :user="user" :remote="true" :inline="true" :transparent="false" :full="true" class="koudoku"/> -->
							</div>
						</div>
						<div class="description">
							<div class="role">
								<span class="state">
									<span v-if="user.isAdmin" class="admin"
										>{{ i18n.ts.admin }}</span
									>
									<span v-if="!user.isAdmin && user.isModerator" class="moderator"
										>{{ i18n.ts.moderator }}</span
									>
								</span>
							</div>
							<Mfm
								v-if="user.description"
								:text="user.description"
								:is-note="false"
								:author="user"
								:i="$i"
								:custom-emojis="user.emojis"
							/>
							<p v-else class="empty">
								{{ i18n.ts.noAccountDescription }}
							</p>
						</div>
						<div v-if=" $i || user.location || birthday || user.host == null" class="fields system">
							<dl v-if="user.location" class="field">
								<dt class="name">
									<i
										class="ph-map-pin ph-bold ph-lg ph-fw ph-lg"
									></i>
									{{ i18n.ts.location }}
								</dt>
								<dd class="value">
									{{ user.location }}{{ timeForThem }}
								</dd>
							</dl>
							<dl v-if="birthday" class="field">
								<dt class="name">
									<i
										class="ph-cake ph-bold ph-lg ph-fw ph-lg"
									></i>
									{{ i18n.ts.birthday }}
								</dt>
								<dd class="value">
									{{
										(birthday.substring(0, 4) == "0000" || birthday.substring(0, 4) == "9999" || birthday.substring(0, 4) == "4000"
											? birthday
											.replaceAll("-0","-")
											.replace("-", "/")
											.replace("-", "/").substring(5)
											: birthday
											.replaceAll("-0","-")
											.replace("-", "/")
											.replace("-", "/")) + (!props.user.birthday || props.user.username === "eroflash" || [":nobuyori_hpb:"].includes(props.user.originalname || props.user.name) ? "?" : "")
									}}
									{{
										nextBirthday === 0
											? `(${i18n.ts.birthdayToday})`
											: birthday.substring(0, 4) != "0000"
											&& birthday.substring(0, 4) != "9999"
											&& birthday.substring(0, 4) != "4000"
											&& age >= 6 && age <= 122
											&& nextBirthday > 9
												? `(${i18n.t("yearsOld", { age: age })})`
												: `(${i18n.t("nextBirthday", { nextBirthday: nextBirthday })})`
									}}
								</dd>
							</dl>
							<dl v-if="user.host == null" class="field">
								<dt class="name">
									<i
										class="ph-calendar-blank ph-bold ph-lg ph-fw ph-lg"
									></i>
									{{ i18n.ts.registeredDate }}
								</dt>
								<dd class="value">
									<MkTime :time="user.createdAt" mode="detail-dateOnly" />
								</dd>
							</dl>
							<dl v-if="($i) || (user.host == null && !user.isBot)" class="field">
								<dt class="name">
									<i
										class="ph-lightning ph-bold ph-lg ph-fw ph-lg"
									></i>
									{{ i18n.ts.power }}
								</dt>
								<dd class="value" >
									<Mfm
										v-if="stats.powerRank?.startsWith('⭐')"
										:text="'$[rainbow.speed=2s ⭐]' + stats.powerRank.slice(1) + ' '"
										:is-note="false"
										:author="user"
										:i="$i"
									/>
									<template v-else>
										{{ stats.powerRank ? `${stats.powerRank} ` : "" }}
									</template>
									<MkNumber :value="stats.power" />
								</dd>
							</dl>
						</div>
						<div v-if="user.fields.length > 0" class="fields">
							<dl
								v-for="(field, i) in user.fields"
								:key="i"
								class="field"
							>
								<dt class="name">
									<Mfm
										:text="field.name"
										:plain="false"
										:is-note="false"
										:custom-emojis="user.emojis"
										:colored="false"
									/>
								</dt>
								<dd class="value">
									<Mfm
										:text="field.value.includes('skeb') ? field.value : field.value.replace(/^https?:\/\/([\w.-]+?)\/@([\w]+)$/,'@$2@$1')"
										:author="user"
										:i="$i"
										:is-note="false"
										:custom-emojis="user.emojis"
										:colored="false"
									/>
								</dd>
							</dl>
						</div>
						<div class="status">
							<MkA
								v-click-anime
								:to="userPage(user)"
								:class="{ active: page === 'index' }"
							>
								<b>{{ number(user.notesCount) }}</b>
								<span>{{ i18n.ts.notes }}</span>
							</MkA>
							<MkA
								v-click-anime
								:to="userPage(user, 'following')"
								:class="{ active: page === 'following' }"
							>
								<b>{{ number(user.followingCount) }}</b>
								<span>{{ i18n.ts.following }}</span>
							</MkA>
							<MkA
								v-click-anime
								:to="userPage(user, 'followers')"
								:class="{ active: page === 'followers' }"
							>
								<b>{{ number(user.followersCount) }}</b>
								<span>{{ i18n.ts.followers }}</span>
							</MkA>
						</div>
					</div>
				</div>

				<div class="contents">
					<template v-if="narrow">
						<XPhotos v-if="!defaultStore.state.enableDataSaverMode" :key="user.id" :user="user" />
						<XActivity
							v-if="!$store.state.hiddenActivityChart && ((!user.host && Date.now() - user.createdAt > (30 * 24 * 60 * 60 * 1000)) || stats?.elapsedDays)"
							:key="user.id"
							:user="user"
							:limit="!stats.elapsedDays || stats.elapsedDays < 30 ? Math.ceil(stats.elapsedDays) : 30"
							:suffix="stats?.averagePostCount ? `(${stats.averagePostCount} /日)` : ''"
							style="margin-top: var(--margin)"
						/>
					</template>
					<div v-if="user.pinnedNotes.length > 0 && narrow" class="_gap">
							<template v-if="($i == null || ($i.id != user.id && !user.isFollowing)) || pinFull">
									<XNote
											v-for="note in user.pinnedNotes"
											:key="note.id"
											class="note _block"
											:note="note"
											:pinned="true"
									/>
							</template>
							<template v-else>
									<XNote
											v-for="note in visiblePinnedNotes"
											:key="note.id"
											class="note _block"
											:note="note"
											:pinned="true"
									/>
									<MkButton style="text-align: center; margin: auto; margin-top: calc(var(--margin) / 2);" v-if="user.pinnedNotes.length > 2 && !pinFull" @click="pinFull = true">{{ i18n.t("moreShowPin", { count: user.pinnedNotes.length - 2 }) }}</MkButton>
							</template>
						</div>
					<MkInfo
						v-if="user.pinnedNotes.length === 0 && $i && $i.id === user.id"
						style="margin: 12px 0"
						>{{ i18n.ts.userPagePinTip }}</MkInfo
					>
				</div>
				<div>
					<XUserTimeline :user="user" />
				</div>
			</div>
			<div v-if="!narrow" class="sub">
				<XPhotos v-if="!defaultStore.state.enableDataSaverMode" :key="user.id" :user="user" />
				<XActivity
					v-if="!$store.state.hiddenActivityChart && stats?.elapsedDays"
					:key="user.id"
					:user="user"
					:limit="stats.elapsedDays < 30 ? Math.ceil(stats.elapsedDays) : 30"
					style="margin-top: var(--margin)"
				/>
				<div v-if="user.pinnedNotes.length > 0" class="_gap">
					<XNote
						v-for="note in user.pinnedNotes"
						:key="note.id"
						class="note _block"
						:note="note"
						:pinned="true"
					/>
				</div>
			</div>
		</div>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from "vue";
import calcAge from "s-age";
import cityTimezones from "city-timezones";
import XUserTimeline from "./index.timeline.vue";
import type * as misskey from "calckey-js";
import XNote from "@/components/MkNote.vue";
import MkButton from "@/components/MkButton.vue";
import MkFollowButton from "@/components/MkFollowButton.vue";
import MkRemoteCaution from "@/components/MkRemoteCaution.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkMoved from "@/components/MkMoved.vue";
import { getScrollPosition } from "@/scripts/scroll";
import { getUserMenu } from "@/scripts/get-user-menu";
import number from "@/filters/number";
import MkNumber from "@/components/MkNumber.vue";
import { userPage } from "@/filters/user";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { useRouter } from "@/router";
import { i18n } from "@/i18n";
import { $i } from "@/account";

const XPhotos = defineAsyncComponent(() => import("./index.photos.vue"));
const XActivity = defineAsyncComponent(() => import("./index.activity.vue"));

const emit = defineEmits(["refresh"]);
const props = withDefaults(
	defineProps<{
		user: misskey.entities.UserDetailed;
	}>(),
	{}
);

const router = useRouter();

const stats = ref<any>({});

let parallaxAnimationId = $ref<null | number>(null);
let narrow = $ref<null | boolean>(null);
let rootEl = $ref<null | HTMLElement>(null);
let bannerEl = $ref<null | HTMLElement>(null);
const pinFull = $ref(false);
const mkBadge = $ref(props.user.badges || []);
const visiblePinnedNotes = $computed(() => {
	return pinFull.value ? props.user.pinnedNotes : props.user.pinnedNotes.slice(0, 2);
});

const birthday = $computed(() => {

	if (props.user.host){
		return props.user.birthday
	}

 if (props.user.username === "eroflash" || [":nobuyori_hpb:"].includes(props.user.originalname || props.user.name)) {
	 let _birthday = props.user.birthday ? new Date(props.user.birthday) : new Date();
	 _birthday.setMonth(new Date().getMonth());
	 _birthday.setDate(new Date().getDate())
	 return `${_birthday.getFullYear()}-${('00' + (_birthday.getMonth() + 1)).slice(-2)}-${('00' + _birthday.getDate()).slice(-2)}`;
 }

	const regtest = /(\d{1,2})(yo|歳|sai)/.test(props.user.name ?? "") || /(\d{1,2})(yo|歳|sai)/.test(props.user.description ?? "");

	if (!regtest){
		return props.user.birthday
	}

	let _birthday;

	const today = new Date();

	if(!props.user.birthday){
		_birthday = new Date();
		_birthday.setMonth(_birthday.getMonth() - 6);
	} else {
		_birthday = new Date(props.user.birthday);
	}

	const dyear = (/(\d{1,2})(yo|歳|sai)/.exec(props.user.name ?? "")?.[1]) ?? (/(\d{1,2})(yo|歳|sai)/.exec(props.user.description ?? "")?.[1]);

	if (dyear == null) return props.user.birthday;

	const dyearint = parseInt(dyear,10);

	if (isNaN(dyearint)) return props.user.birthday;

	_birthday.setFullYear(today.getFullYear() - dyearint);

	const y8date = new Date();
	y8date.setFullYear(today.getFullYear() - dyearint)
	y8date.setHours(0);
	y8date.setMinutes(0);
	y8date.setSeconds(0);
	y8date.setMilliseconds(0);

	if (_birthday > y8date) _birthday.setFullYear(_birthday.getFullYear() - 1);

	return `${_birthday.getFullYear()}-${('00' + (_birthday.getMonth() + 1)).slice(-2)}-${('00' + _birthday.getDate()).slice(-2)}`;
})

const style = $computed(() => {
	if (props.user.bannerUrl == null || (defaultStore.state.enableDataSaverMode && defaultStore.state.dataSaverDisabledBanner)) return {};
	return {
		backgroundImage: `url(${props.user.bannerUrl})`,
	};
});

const age = $computed(() => {
	return calcAge(birthday);
});

const nextBirthday = $computed(() => {

	const _birthday = new Date(birthday?.replaceAll("-","/"));
	_birthday.setHours(0);

	const today = new Date();
	today.setHours(0);
	today.setMinutes(0);
	today.setSeconds(0);
	today.setMilliseconds(0);

	_birthday.setFullYear(today.getFullYear());

	return _birthday >= today
			? Math.floor((_birthday.valueOf() - today.valueOf()) / (24 * 60 * 60 * 1000))
			: Math.floor((_birthday.setFullYear(_birthday.getFullYear() + 1) - today.valueOf()) / (24 * 60 * 60 * 1000));
});

const timeForThem = $computed(() => {
	const maybeCityNames = [
		props.user.location!,
		props.user
			.location!.replace(
				/[^A-Za-z0-9ÁĆÉǴÍḰĹḾŃÓṔŔŚÚÝŹáćéǵíḱĺḿńóṕŕśúýź\-\'\.\s].*/,
				""
			)
			.trim(),
		props.user.location!.replace(
			/[^A-Za-zÁĆÉǴÍḰĹḾŃÓṔŔŚÚÝŹáćéǵíḱĺḿńóṕŕśúýź\-\'\.].*/,
			""
		),
		props.user.location!.replace(
			/[^A-Za-zÁĆÉǴÍḰĹḾŃÓṔŔŚÚÝŹáćéǵíḱĺḿńóṕŕśúýź].*/,
			""
		),
		"Tokyo",
	];

	for (const city of maybeCityNames) {
		let tzInfo = cityTimezones.lookupViaCity(city);
		if (tzInfo.length == 0) continue;

		const tz = tzInfo[0].timezone;
		if (!tz) continue;

		const theirTime = new Date().toLocaleString("en-US", {
			timeZone: tz,
			hour12: false,
		});
		return ` (${theirTime.split(",")[1].trim().split(":")[0]}:${theirTime
			.split(" ")[1]
			.slice(-5, -3)})`;
	}

	return "";
});

function menu(ev) {
	os.popupMenu(
		getUserMenu(props.user, router),
		ev.currentTarget ?? ev.target
	);
}

function parallaxLoop() {
	parallaxAnimationId = window.requestAnimationFrame(parallaxLoop);
	parallax();
}

function parallax() {
	const banner = bannerEl as any;
	if (banner == null) return;

	const top = getScrollPosition(rootEl);

	if (top < 0) return;

	const z = 1.75; // 奥行き(小さいほど奥)
	const pos = -(top / z);
	banner.style.backgroundPosition = `center calc(50% - ${pos}px)`;
}

onMounted(() => {
	if ($i || props.user.host == null) {
		os.api("users/stats", {
			userId: props.user.id,
			simple: true,
		}).then((response) => {
			stats.value = response;
		});
	}
	window.requestAnimationFrame(parallaxLoop);
	narrow = rootEl!.clientWidth < 1000;
});

onUnmounted(() => {
	if (parallaxAnimationId) {
		window.cancelAnimationFrame(parallaxAnimationId);
	}
});
</script>

<style lang="scss" scoped>
.ftskorzw {
	> .main {
		> .punished {
			font-size: 0.8em;
			padding: 16px;
		}

		> .profile {
			> .main {
				position: relative;
				overflow: hidden;

				> .banner-container {
					position: relative;
					height: 250px;
					overflow: hidden;
					background-size: cover;
					background-position: center;

					> .banner {
						height: 100%;
						background-color: #26233a;
						background-size: cover;
						background-position: center;
						box-shadow: 0 0 128px var(--shadow) inset;
						will-change: background-position;

						&::after {
							content: "";
							background-image: var(--blur, inherit);
							position: fixed;
							inset: 0;
							background-size: cover;
							background-position: center;
							pointer-events: none;
							opacity: 0.1;
							filter: var(--blur, blur(10px));
						}
					}

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 78px;
						background: linear-gradient(
							transparent,
							rgba(#000, 0.7)
						);
					}

					> .followed {
						position: absolute;
						top: 10px;
						left: 120px;
						padding: 4px 8px;
						color: #fff;
						background: rgba(0, 0, 0, 0.7);
						font-size: 0.7em;
						border-radius: 6px;
					}

					> .actions {
						position: absolute;
						top: 12px;
						right: 12px;
						padding: 8px;
						border-radius: 24px;

						> .menu {
							vertical-align: bottom;
							height: 31px;
							width: 31px;
							color: #fff;
							text-shadow: 0 0 8px var(--shadow);
							font-size: 16px;
						}

						> .koudoku {
							margin-left: 4px;
							width: 31px;
							vertical-align: bottom;
						}
					}

					> .title {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						padding: 0 0 8px 154px;
						box-sizing: border-box;
						color: #fff;

						> .nameCollumn {
							display: block;
							> .name {
								margin: 0;
								line-height: 32px;
								font-weight: bold;
								font-size: 1.8em;
								text-shadow: 0 0 8px var(--shadow);
							}

							> .followed {
								position: relative;
								top: -4px;
								left: 4px;
								padding: 4px 8px;
								color: #fff;
								background: rgba(0, 0, 0, 0.6);
								font-size: 0.7em;
								border-radius: 24px;
							}
						}

						> .bottom {
							> * {
								display: inline-block;
								margin-right: 16px;
								line-height: 20px;
								opacity: 0.8;

								&.username {
									font-weight: bold;
								}
							}
						}
					}
				}

				> .follow-container {
					position: relative;
					height: 60px;
					overflow: hidden;
					background-size: cover;
					background-position: center;
					z-index: 100;

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 78px;
						background: linear-gradient(
							transparent,
							rgba(#000, 0.7)
						);
					}

					> .actions {
						position: absolute;
						top: 12px;
						right: 12px;
						padding: 8px;
						border-radius: 24px;

						> .menu {
							vertical-align: bottom;
							height: 31px;
							width: 31px;
							color: --fg;
							font-size: 16px;
						}

						> .koudoku {
							margin-left: 4px;
							vertical-align: bottom;
						}
					}

					> .title {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						padding: 0 0 8px 154px;
						box-sizing: border-box;
						color: #fff;

						> .name {
							display: block;
							margin: 0;
							line-height: 32px;
							font-weight: bold;
							font-size: 1.8em;
							text-shadow: 0 0 8px var(--shadow);
						}

						> .bottom {
							> * {
								display: inline-block;
								margin-right: 16px;
								line-height: 20px;
								opacity: 0.8;

								&.username {
									font-weight: bold;
								}
							}
						}
					}
				}

				> .title {
					display: none;
					text-align: center;
					padding: 50px 8px 16px 8px;
					font-weight: bold;
					border-bottom: solid 0.5px var(--divider);

					> .nameCollumn {
						display: block;
						> .name {
							margin: 0;
							align-content: center;
							line-height: 32px;
							font-weight: bold;
							font-size: 1.8em;
							text-shadow: 0 0 8px var(--shadow);
						}

						> .followed {
							position: relative;
							top: -4px;
							left: 4px;
							padding: 4px 8px;
							color: #fff;
							background: rgba(0, 0, 0, 0.6);
							font-size: 0.7em;
							border-radius: 24px;
						}
					}

					> .followedWindow {
						position: relative;
						top: -25px;
						left: 80px;
						padding: 4px 8px;
						color: #fff;
						background: rgba(0, 0, 0, 0.6);
						font-size: 0.7em;
						border-radius: 24px;
					}

					> .bottom {
						> * {
							display: inline-block;
							margin-right: 8px;
							opacity: 0.8;
						}
						> .badge {
							opacity: 1 !important;
						}
					}
				}

				> .avatar {
					display: block;
					position: absolute;
					top: 170px;
					left: 16px;
					z-index: 2;
					width: 120px;
					height: 120px;
					box-shadow: 1px 1px 3px rgba(#000, 0.2);
				}

				> .description {
					padding: 72px 12px 2px 24px;
					font-size: 0.95em;
					top: -55px;
					position: relative;

					> .empty {
						margin: 0;
						opacity: 0.5;
					}

					> .role {
						> .state {
							display: none;
							gap: 8px;
							flex-wrap: wrap;
							margin-top: 4px;

							&:empty {
								display: none;
							}

							> .suspended,
							> .silenced,
							> .moderator,
							> .admin {
								display: inline-block;
								border: solid 1px;
								border-radius: 6px;
								padding: 2px 6px;
								font-size: 85%;
							}

							> .suspended,
							> .admin {
								color: var(--error);
								border-color: var(--error);
							}

							> .silenced {
								color: var(--warn);
								border-color: var(--warn);
							}

							> .moderator {
								color: var(--success);
								border-color: var(--success);
							}
						}
					}
				}

				> .fields {
					padding: 24px;
					font-size: 0.9em;
					border-top: solid 0.5px var(--divider);

					> .field {
						display: flex;
						padding: 0;
						margin: 0;
						align-items: center;

						&:not(:last-child) {
							margin-bottom: 8px;
						}

						> .name {
							width: 30%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							font-weight: bold;
							text-align: center;
						}

						> .value {
							width: 70%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							margin: 0;
						}
					}

					&.system > .field > .name {
					}
				}

				> .status {
					display: flex;
					padding: 24px;
					border-top: solid 0.5px var(--divider);

					> a {
						flex: 1;
						text-align: center;

						&.active {
							color: var(--accent);
						}

						&:hover {
							text-decoration: none;
						}

						> b {
							display: block;
							line-height: 16px;
						}

						> span {
							font-size: 70%;
						}
					}
				}
			}
		}

		> .contents {
			margin-top: var(--margin);
			> .content {
				margin-bottom: var(--margin);
			}
		}
	}

	&.max-width_500px {
		> .main {
			> .profile > .main {
				> .banner-container {
					height: 140px;

					> .fade {
						display: none;
					}

					> .title {
						display: none;
					}
				}

				> .title {
					display: block;
				}

				> .avatar {
					top: 90px;
					left: 0;
					right: 0;
					width: 92px;
					height: 92px;
					margin: auto;
				}

				> .description {
					padding: 16px;
					text-align: center;
				}

				> .fields {
					padding: 16px;
				}

				> .status {
					padding: 16px;
				}

				> .description {
					top: -55px;
					position: relative;
				}

				> .follow-container {
					overflow: visible !important;
					> .actions {
						top: -110px;
						right: 0px;
					}
				}
			}

			> .contents {
				> .nav {
					font-size: 80%;
				}
			}
		}
	}

	&.wide {
		display: flex;
		width: 100%;

		> .main {
			width: 100%;
			min-width: 0;
		}

		> .sub {
			max-width: 350px;
			min-width: 350px;
			margin-left: var(--margin);
		}
	}
}
</style>
