import autobind from 'autobind-decorator';
import Channel from '../channel';

export default class extends Channel {
	@autobind
	public async init(params: any) {
		// Subscribe messaging index stream
		this.subscriber.on(`messagingIndexStream:${this.user._id}`, data => {
			this.send(data);
		});
	}
}
