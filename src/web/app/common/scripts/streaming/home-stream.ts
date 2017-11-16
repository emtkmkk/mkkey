import Stream from './stream';
import signout from '../signout';

/**
 * Home stream connection
 */
export default class Connection extends Stream {
	constructor(me) {
		super('', {
			i: me.token
		});

		// 最終利用日時を更新するため定期的にaliveメッセージを送信
		setInterval(() => {
			this.send({ type: 'alive' });
		}, 1000 * 60);

		// 自分の情報が更新されたとき
		this.on('i_updated', me.update);

		// トークンが再生成されたとき
		// このままではAPIが利用できないので強制的にサインアウトさせる
		this.on('my_token_regenerated', () => {
			alert('%i18n:common.my-token-regenerated%');
			signout();
		});
	}
}
