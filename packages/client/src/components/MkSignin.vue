<template>
	<form
		class="eppvobhk _monolithic_"
		:class="{ signing, totpLogin }"
		@submit.prevent="onSubmit"
	>
		<div class="auth _section _formRoot">
			<div
				v-show="withAvatar"
				class="avatar"
				:style="{
					backgroundImage: user ? `url('${user.avatarUrl}')` : null,
					marginBottom: message ? '1.5em' : null,
				}"
			></div>
			<MkInfo v-if="message">
				{{ message }}
			</MkInfo>
			<div v-if="!totpLogin" class="normal-signin">
				<MkInput
					v-model="username"
					class="_formBlock"
					:placeholder="i18n.ts.username"
					type="text"
					pattern="^[a-zA-Z0-9_]+$"
					:spellcheck="false"
					:autofocus="!hasAlternativeSignInMethod"
					required
					data-cy-signin-username
					@update:modelValue="onUsernameChange"
				>
					<template #prefix>@</template>
					<template #suffix>@{{ host }}</template>
				</MkInput>
				<MkInput
					v-if="!user || (user && (!user.usePasswordLessLogin || password))"
					v-model="password"
					class="_formBlock"
					:placeholder="i18n.ts.password"
					type="password"
					:with-password-toggle="true"
					required
					data-cy-signin-password
				>
					<template #prefix
						><i class="ph-lock ph-bold ph-lg"></i
					></template>
					<template #caption
						><button
							class="_textButton"
							type="button"
							@click="resetPassword"
						>
							{{ i18n.ts.forgotPassword }}
						</button></template
					>
				</MkInput>
				<MkButton
					class="_formBlock"
					type="submit"
					primary
					:disabled="signing"
					style="margin: 1rem auto"
					>{{ signing ? i18n.ts.loggingIn : i18n.ts.login }}</MkButton>
			</div>
			<div
				v-if="totpLogin"
				class="totp-signin"
				:class="{ securityKeys: user && user.securityKeys }"
			>
				<div
					v-if="user && user.securityKeys"
					class="twofa-group tap-group"
				>
					<p>{{ i18n.ts.tapSecurityKey }}</p>
					<p v-if="totpErrorMessage" class="totp-error">
						{{ totpErrorMessage }}
					</p>
					<MkButton v-if="!queryingKey" @click="queryKey">
						{{ i18n.ts.retry }}
					</MkButton>
				</div>
				<div v-if="user && user.securityKeys" class="or-hr">
					<p class="or-msg">{{ i18n.ts.or }}</p>
				</div>
				<div class="twofa-group totp-group">
					<p style="margin-bottom: 0">
						{{
							user && user.twoFactorEnabled
								? i18n.ts.twoStepAuthentication
								: i18n.ts.password
						}}
					</p>
					<MkInput
						v-if="user && user.usePasswordLessLogin"
						v-model="password"
						class="_formBlock"
						type="password"
						:with-password-toggle="true"
						required
					>
						<template #label>{{ i18n.ts.password }}</template>
						<template #prefix
							><i class="ph-lock ph-bold ph-lg"></i
						></template>
					</MkInput>
					<MkInput
						v-if="user && user.twoFactorEnabled"
						v-model="token"
						class="_formBlock"
						type="text"
						pattern="^[0-9]{6}$"
						autocomplete="off"
						:spellcheck="false"
						required
					>
						<template #label>{{ i18n.ts.token }}</template>
						<template #prefix
							><i class="ph-poker-chip ph-bold ph-lg"></i
						></template>
					</MkInput>
					<MkButton
						class="_formBlock"
						type="submit"
						:disabled="signing"
						primary
						>{{
							signing ? i18n.ts.loggingIn : i18n.ts.login
						}}</MkButton
					>
				</div>
			</div>
		</div>
		<div class="social _section">
			<a
				v-if="meta && meta.enableTwitterIntegration"
				class="_borderButton _gap"
				:href="`${apiUrl}/signin/twitter`"
				><i
					class="social-icon ph-twitter-logo ph-bold ph-lg"
				></i
				>{{ i18n.t("signinWith", { x: "Twitter" }) }}</a
			>
			<a
				v-if="meta && meta.enableGithubIntegration"
				class="_borderButton _gap"
				:href="`${apiUrl}/signin/github`"
				><i
					class="social-icon ph-github-logo ph-bold ph-lg"
				></i
				>{{ i18n.t("signinWith", { x: "GitHub" }) }}</a
			>
			<button
				v-if="isPasskeySupported"
				class="_borderButton _gap"
				type="button"
				:disabled="signing || queryingKey"
				@click="signinWithPasskey"
			>
				<i class="social-icon ph-key ph-bold ph-lg"></i>
				{{ i18n.t("signinWith", { x: i18n.ts.securityKey }) }}
			</button>
			<a
				v-if="meta && meta.enableGoogleIntegration"
				class="_borderButton _gap"
				:href="`${apiUrl}/signin/google`"
				><i class="social-icon ph-google-logo ph-bold ph-lg"></i
				>{{ i18n.t("signinWith", { x: "Google" }) }}</a
			>
			<a
				v-if="meta && meta.enableDiscordIntegration"
				class="_borderButton _gap"
				:href="`${apiUrl}/signin/discord`"
				><i
					class="social-icon ph-discord-logo ph-bold ph-lg"
				></i
				>{{ i18n.t("signinWith", { x: "Discord" }) }}</a
			>
		</div>
	</form>
</template>

<script lang="ts" setup>
import { defineAsyncComponent } from "vue";
import { toUnicode } from "punycode/";
import { showSuspendedDialog } from "../scripts/show-suspended-dialog";
import { showDeletedDialog } from "../scripts/show-deleted-dialog";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkInfo from "@/components/MkInfo.vue";
import { apiUrl, host as configHost } from "@/config";
import { byteify, hexify } from "@/scripts/2fa";
import * as os from "@/os";
import { login } from "@/account";
import { instance } from "@/instance";
import { i18n } from "@/i18n";

let signing = $ref(false);
let user = $ref(null);
let username = $ref("");
let password = $ref("");
let token = $ref("");
let host = $ref(toUnicode(configHost));
let totpLogin = $ref(false);
let challengeData = $ref(null);
let queryingKey = $ref(false);
let hCaptchaResponse = $ref(null);
let reCaptchaResponse = $ref(null);
let userFetching = $ref<Promise<void> | null>(null);
let totpErrorMessage = $ref("");

const meta = $computed(() => instance);
const isPasskeySupported = $computed(
	() =>
		typeof window !== "undefined" &&
		typeof navigator !== "undefined" &&
		!!window.PublicKeyCredential &&
		!!navigator.credentials,
);
const hasExternalServiceSignIn = $computed(
	() =>
		!!meta &&
		(
			meta.enableTwitterIntegration ||
			meta.enableGithubIntegration ||
			meta.enableGoogleIntegration ||
			meta.enableDiscordIntegration
		),
);
const hasAlternativeSignInMethod = $computed(
	() => isPasskeySupported || hasExternalServiceSignIn,
);

const emit = defineEmits<{
	(ev: "login", v: any): void;
}>();

const props = defineProps({
	withAvatar: {
		type: Boolean,
		required: false,
		default: true,
	},
	autoSet: {
		type: Boolean,
		required: false,
		default: false,
	},
	message: {
		type: String,
		required: false,
		default: "",
	},
});

function fetchUser() {
	if (!username) {
		user = null;
		return Promise.resolve();
	}
	if (userFetching) {
		return userFetching;
	}
	const promise = os
		.api(
			"users/show",
			{
				username: username,
			},
			undefined,
			true,
		)
		.then(
			(userResponse) => {
				user = userResponse;
			},
			() => {
				user = null;
			},
		)
		.finally(() => {
			userFetching = null;
		});
	userFetching = promise;
	return promise;
}

function onUsernameChange() {
	totpErrorMessage = "";
	fetchUser();
}

function onLogin(res) {
	if (props.autoSet) {
		return login(res.i);
	}
}

function queryKey() {
	totpErrorMessage = "";
	queryingKey = true;
	return navigator.credentials
		.get({
			publicKey: {
				challenge: byteify(challengeData.challenge, "base64"),
				allowCredentials: challengeData.securityKeys.map((key) => ({
					id: byteify(key.id, "hex"),
					type: "public-key",
					transports: ["usb", "nfc", "ble", "internal"],
				})),
				timeout: 60 * 1000,
				userVerification: "preferred",
			},
		})
		.catch(() => {
			queryingKey = false;
			signing = false;
			totpErrorMessage = i18n.ts.loginFailed;
			return Promise.reject(null);
		})
		.then((credential) => {
			queryingKey = false;
			signing = true;
			return os.api("signin", {
				signature: hexify(credential.response.signature),
				authenticatorData: hexify(
					credential.response.authenticatorData
				),
				clientDataJSON: hexify(credential.response.clientDataJSON),
				credentialId: credential.id,
				challengeId: challengeData.challengeId,
				"hcaptcha-response": hCaptchaResponse,
				"g-recaptcha-response": reCaptchaResponse,
			});
		})
		.then((res) => {
			emit("login", res);
			return onLogin(res);
		})
		.catch((err) => {
			if (err === null) return;
			showSigninError(err, { inlinePasskeyError: true, keepTotpState: true });
			signing = false;
		});
}


async function signinWithPasskey() {
	if (!window.PublicKeyCredential || !navigator.credentials) return;
	signing = true;
	queryingKey = true;

	os.api("signin/passkey-challenge", {}, undefined, true)
		.then((res) => {
			challengeData = res;
			return navigator.credentials.get({
				publicKey: {
					challenge: byteify(res.challenge, "base64"),
					timeout: 60 * 1000,
					userVerification: "preferred",
				},
			});
		})
		.then((passkeyCredential) => {
			const credential = passkeyCredential as PublicKeyCredential;
			const response = credential.response as AuthenticatorAssertionResponse;
			return os.api("signin", {
				signature: hexify(response.signature),
				authenticatorData: hexify(response.authenticatorData),
				clientDataJSON: hexify(response.clientDataJSON),
				credentialId: credential.id,
				userHandle: response.userHandle ? hexify(response.userHandle) : null,
				challengeId: challengeData.challengeId,
				"hcaptcha-response": hCaptchaResponse,
				"g-recaptcha-response": reCaptchaResponse,
			});
		})
		.then((res) => {
			emit("login", res);
			return onLogin(res);
		})
		.catch(loginFailed)
		.finally(() => {
			queryingKey = false;
			signing = false;
		});
}

async function onSubmit() {
	signing = true;
	totpErrorMessage = "";
	if (!user && username) {
		await fetchUser();
	}
	if (!totpLogin && user && (user.twoFactorEnabled || user.usePasswordLessLogin)) {
		if (window.PublicKeyCredential && user.securityKeys) {
			os.api("signin", {
				username,
				password,
				"hcaptcha-response": hCaptchaResponse,
				"g-recaptcha-response": reCaptchaResponse,
			})
				.then((res) => {
					if (!res || !res.challenge || !res.securityKeys) {
						emit("login", res);
						onLogin(res);
						return;
					}

					totpLogin = true;
					signing = false;
					challengeData = res;
					return queryKey();
				})
				.catch(loginFailed);
		} else {
			totpLogin = true;
			signing = false;
		}
	} else {
		os.api("signin", {
			username,
			password,
			"hcaptcha-response": hCaptchaResponse,
			"g-recaptcha-response": reCaptchaResponse,
			token: user && user.twoFactorEnabled ? token : undefined,
		})
			.then((res) => {
				if (!res || !res.challenge || !res.securityKeys) {
					emit("login", res);
					onLogin(res);
					return;
				}

				challengeData = res;
				signing = false;
				return queryKey();
			})
			.catch(loginFailed);
	}
}

function loginFailed(err) {
	if (err == null) {
		totpErrorMessage = i18n.ts.loginFailed;
		signing = false;
		return;
	}

	const keepTotpState = totpLogin;
	showSigninError(err, { inlinePasskeyError: keepTotpState, keepTotpState });

	if (!keepTotpState) {
		challengeData = null;
		totpLogin = false;
	}
	signing = false;
}

function isPasskeySigninError(err): boolean {
	if (!err || typeof err !== "object") return false;
	const passkeyErrorIds = [
		"66269679-aeaf-4474-862b-eb761197e046",
		"2715a88a-2125-4013-932f-aa6fe72792da",
		"93b86c4b-72f9-40eb-9815-798928603d1e",
	];
	return typeof err.id === "string" && passkeyErrorIds.includes(err.id);
}

function getSigninErrorText(err): string {
	if (!err || typeof err !== "object") return i18n.ts.signinFailed;

	switch (err.id) {
		case "6cc579cc-885d-43d8-95c2-b8c7fc963280":
			return i18n.ts.noSuchUser;
		case "932c904e-9460-45b7-9ce6-7ed33be7eb2c":
			return i18n.ts.incorrectPassword;
		case "22d05606-fbcf-421a-a2db-b32610dcfd1b":
			return i18n.ts.rateLimitExceeded;
		case "cdf1235b-ac71-46d4-a3a6-84ccce48df6f":
			return i18n.ts.signinFailed;
		default:
			return typeof err.message === "string" ? err.message : i18n.ts.signinFailed;
	}
}

function showSigninError(
	err,
	options: { inlinePasskeyError: boolean; keepTotpState: boolean },
) {
	if (err?.id === "e03a5f46-d309-4865-9b69-56282d94e1eb") {
		showSuspendedDialog();
		return;
	}

	if (err?.id === "b8f1a6c2-3d47-4e59-9a0b-2c7e5d4f8a13") {
		showDeletedDialog();
		return;
	}

	const text = getSigninErrorText(err);
	const showInline = options.inlinePasskeyError && isPasskeySigninError(err);

	if (showInline) {
		totpErrorMessage = text;
		return;
	}

	os.alert({
		type: "error",
		title: i18n.ts.loginFailed,
		text,
	});

	if (!options.keepTotpState) {
		totpErrorMessage = "";
	}
}

function resetPassword() {
	os.popup(
		defineAsyncComponent(() => import("@/components/MkForgotPassword.vue")),
		{},
		{},
		"closed"
	);
}
</script>

<style lang="scss" scoped>
.eppvobhk {
	> .auth {
		> .avatar {
			margin: 0 auto 0 auto;
			width: 4rem;
			height: 4rem;
			background: #ddd;
			background-position: center;
			background-size: cover;
			border-radius: 100%;
		}

		.totp-signin {
			.totp-group > button[type="submit"] {
				margin: 1rem auto 0;
			}

			.totp-error {
				margin: 0.5rem 0 0;
				color: var(--error);
			}
		}
	}

	.social-icon {
		margin-right: 0;
	}

	.social {
		> ._borderButton {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}
	}

}
</style>
