import { markRaw } from 'vue';
import { locale } from '@client/config';
import { I18n } from '../misc/i18n';

export const i18n = markRaw(new I18n(locale));

// このファイルに書きたくないけどここに書かないと何故かVeturが認識しない
declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		$t: typeof i18n['t'];
		$ts: typeof i18n['locale'];
	}
}
