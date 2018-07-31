import * as websocket from 'websocket';
import Xev from 'xev';
import * as CRC32 from 'crc-32';
import ReversiGame, { pack } from '../../../../models/games/reversi/game';
import { publishReversiGameStream } from '../../../../stream';
import Reversi from '../../../../games/reversi/core';
import * as maps from '../../../../games/reversi/maps';
import { ParsedUrlQuery } from 'querystring';

export default function(request: websocket.request, connection: websocket.connection, subscriber: Xev, user?: any): void {
	const q = request.resourceURL.query as ParsedUrlQuery;
	const gameId = q.game as string;

	// Subscribe game stream
	subscriber.on(`reversi-game-stream:${gameId}`, data => {
		connection.send(JSON.stringify(data));
	});

	connection.on('message', async (data) => {
		const msg = JSON.parse(data.utf8Data);

		switch (msg.type) {
			case 'accept':
				accept(true);
				break;

			case 'cancel-accept':
				accept(false);
				break;

			case 'update-settings':
				if (msg.settings == null) return;
				updateSettings(msg.settings);
				break;

			case 'init-form':
				if (msg.body == null) return;
				initForm(msg.body);
				break;

			case 'update-form':
				if (msg.id == null || msg.value === undefined) return;
				updateForm(msg.id, msg.value);
				break;

			case 'message':
				if (msg.body == null) return;
				message(msg.body);
				break;

			case 'set':
				if (msg.pos == null) return;
				set(msg.pos);
				break;

			case 'check':
				if (msg.crc32 == null) return;
				check(msg.crc32);
				break;
		}
	});

	async function updateSettings(settings: any) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (game.isStarted) return;
		if (!game.user1Id.equals(user._id) && !game.user2Id.equals(user._id)) return;
		if (game.user1Id.equals(user._id) && game.user1Accepted) return;
		if (game.user2Id.equals(user._id) && game.user2Accepted) return;

		await ReversiGame.update({ _id: gameId }, {
			$set: {
				settings
			}
		});

		publishReversiGameStream(gameId, 'update-settings', settings);
	}

	async function initForm(form: any) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (game.isStarted) return;
		if (!game.user1Id.equals(user._id) && !game.user2Id.equals(user._id)) return;

		const set = game.user1Id.equals(user._id) ? {
			form1: form
		} : {
				form2: form
			};

		await ReversiGame.update({ _id: gameId }, {
			$set: set
		});

		publishReversiGameStream(gameId, 'init-form', {
			userId: user._id,
			form
		});
	}

	async function updateForm(id: string, value: any) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (game.isStarted) return;
		if (!game.user1Id.equals(user._id) && !game.user2Id.equals(user._id)) return;

		const form = game.user1Id.equals(user._id) ? game.form2 : game.form1;

		const item = form.find((i: any) => i.id == id);

		if (item == null) return;

		item.value = value;

		const set = game.user1Id.equals(user._id) ? {
			form2: form
		} : {
				form1: form
			};

		await ReversiGame.update({ _id: gameId }, {
			$set: set
		});

		publishReversiGameStream(gameId, 'update-form', {
			userId: user._id,
			id,
			value
		});
	}

	async function message(message: any) {
		message.id = Math.random();
		publishReversiGameStream(gameId, 'message', {
			userId: user._id,
			message
		});
	}

	async function accept(accept: boolean) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (game.isStarted) return;

		let bothAccepted = false;

		if (game.user1Id.equals(user._id)) {
			await ReversiGame.update({ _id: gameId }, {
				$set: {
					user1Accepted: accept
				}
			});

			publishReversiGameStream(gameId, 'change-accepts', {
				user1: accept,
				user2: game.user2Accepted
			});

			if (accept && game.user2Accepted) bothAccepted = true;
		} else if (game.user2Id.equals(user._id)) {
			await ReversiGame.update({ _id: gameId }, {
				$set: {
					user2Accepted: accept
				}
			});

			publishReversiGameStream(gameId, 'change-accepts', {
				user1: game.user1Accepted,
				user2: accept
			});

			if (accept && game.user1Accepted) bothAccepted = true;
		} else {
			return;
		}

		if (bothAccepted) {
			// 3秒後、まだacceptされていたらゲーム開始
			setTimeout(async () => {
				const freshGame = await ReversiGame.findOne({ _id: gameId });
				if (freshGame == null || freshGame.isStarted || freshGame.isEnded) return;
				if (!freshGame.user1Accepted || !freshGame.user2Accepted) return;

				let bw: number;
				if (freshGame.settings.bw == 'random') {
					bw = Math.random() > 0.5 ? 1 : 2;
				} else {
					bw = freshGame.settings.bw as number;
				}

				function getRandomMap() {
					const mapCount = Object.entries(maps).length;
					const rnd = Math.floor(Math.random() * mapCount);
					return Object.values(maps)[rnd].data;
				}

				const map = freshGame.settings.map != null ? freshGame.settings.map : getRandomMap();

				await ReversiGame.update({ _id: gameId }, {
					$set: {
						startedAt: new Date(),
						isStarted: true,
						black: bw,
						'settings.map': map
					}
				});

				//#region 盤面に最初から石がないなどして始まった瞬間に勝敗が決定する場合があるのでその処理
				const o = new Reversi(map, {
					isLlotheo: freshGame.settings.isLlotheo,
					canPutEverywhere: freshGame.settings.canPutEverywhere,
					loopedBoard: freshGame.settings.loopedBoard
				});

				if (o.isEnded) {
					let winner;
					if (o.winner === true) {
						winner = freshGame.black == 1 ? freshGame.user1Id : freshGame.user2Id;
					} else if (o.winner === false) {
						winner = freshGame.black == 1 ? freshGame.user2Id : freshGame.user1Id;
					} else {
						winner = null;
					}

					await ReversiGame.update({
						_id: gameId
					}, {
							$set: {
								isEnded: true,
								winnerId: winner
							}
						});

					publishReversiGameStream(gameId, 'ended', {
						winnerId: winner,
						game: await pack(gameId, user)
					});
				}
				//#endregion

				publishReversiGameStream(gameId, 'started', await pack(gameId, user));
			}, 3000);
		}
	}

	// 石を打つ
	async function set(pos: number) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (!game.isStarted) return;
		if (game.isEnded) return;
		if (!game.user1Id.equals(user._id) && !game.user2Id.equals(user._id)) return;

		const o = new Reversi(game.settings.map, {
			isLlotheo: game.settings.isLlotheo,
			canPutEverywhere: game.settings.canPutEverywhere,
			loopedBoard: game.settings.loopedBoard
		});

		game.logs.forEach(log => {
			o.put(log.color, log.pos);
		});

		const myColor =
			(game.user1Id.equals(user._id) && game.black == 1) || (game.user2Id.equals(user._id) && game.black == 2)
				? true
				: false;

		if (!o.canPut(myColor, pos)) return;
		o.put(myColor, pos);

		let winner;
		if (o.isEnded) {
			if (o.winner === true) {
				winner = game.black == 1 ? game.user1Id : game.user2Id;
			} else if (o.winner === false) {
				winner = game.black == 1 ? game.user2Id : game.user1Id;
			} else {
				winner = null;
			}
		}

		const log = {
			at: new Date(),
			color: myColor,
			pos
		};

		const crc32 = CRC32.str(game.logs.map(x => x.pos.toString()).join('') + pos.toString());

		await ReversiGame.update({
			_id: gameId
		}, {
				$set: {
					crc32,
					isEnded: o.isEnded,
					winnerId: winner
				},
				$push: {
					logs: log
				}
			});

		publishReversiGameStream(gameId, 'set', Object.assign(log, {
			next: o.turn
		}));

		if (o.isEnded) {
			publishReversiGameStream(gameId, 'ended', {
				winnerId: winner,
				game: await pack(gameId, user)
			});
		}
	}

	async function check(crc32: string) {
		const game = await ReversiGame.findOne({ _id: gameId });

		if (!game.isStarted) return;

		// 互換性のため
		if (game.crc32 == null) return;

		if (crc32 !== game.crc32) {
			connection.send(JSON.stringify({
				type: 'rescue',
				body: await pack(game, user)
			}));
		}
	}
}
