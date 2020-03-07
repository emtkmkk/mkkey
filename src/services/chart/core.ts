/**
 * チャートエンジン
 *
 * Tests located in test/chart
 */

import * as nestedProperty from 'nested-property';
import autobind from 'autobind-decorator';
import Logger from '../logger';
import { Schema } from '../../misc/schema';
import { EntitySchema, getRepository, Repository, LessThan, Between } from 'typeorm';
import { dateUTC, isTimeSame, isTimeBefore, subtractTime, addTime } from '../../prelude/time';
import { getChartInsertLock } from '../../misc/app-lock';

const logger = new Logger('chart', 'white', process.env.NODE_ENV !== 'test');

export type Obj = { [key: string]: any };

export type DeepPartial<T> = {
	[P in keyof T]?: DeepPartial<T[P]>;
};

type ArrayValue<T> = {
	[P in keyof T]: T[P] extends number ? T[P][] : ArrayValue<T[P]>;
};

type Span = 'day' | 'hour';

type Log = {
	id: number;

	/**
	 * 集計のグループ
	 */
	group: string | null;

	/**
	 * 集計日時のUnixタイムスタンプ(秒)
	 */
	date: number;

	/**
	 * 集計期間
	 */
	span: Span;

	/**
	 * ユニークインクリメント用
	 */
	unique?: Record<string, any>;
};

const camelToSnake = (str: string) => {
	return str.replace(/([A-Z])/g, s => '_' + s.charAt(0).toLowerCase());
};

/**
 * 様々なチャートの管理を司るクラス
 */
export default abstract class Chart<T extends Record<string, any>> {
	private static readonly columnPrefix = '___';
	private static readonly columnDot = '_';

	private name: string;
	public schema: Schema;
	protected repository: Repository<Log>;
	protected abstract genNewLog(latest: T): DeepPartial<T>;
	protected abstract async fetchActual(group: string | null): Promise<DeepPartial<T>>;

	@autobind
	private static convertSchemaToFlatColumnDefinitions(schema: Schema) {
		const columns = {} as any;
		const flatColumns = (x: Obj, path?: string) => {
			for (const [k, v] of Object.entries(x)) {
				const p = path ? `${path}${this.columnDot}${k}` : k;
				if (v.type === 'object') {
					flatColumns(v.properties, p);
				} else {
					columns[this.columnPrefix + p] = {
						type: 'bigint',
					};
				}
			}
		};
		flatColumns(schema.properties!);
		return columns;
	}

	@autobind
	private static convertFlattenColumnsToObject(x: Record<string, number>) {
		const obj = {} as any;
		for (const k of Object.keys(x).filter(k => k.startsWith(Chart.columnPrefix))) {
			// now k is ___x_y_z
			const path = k.substr(Chart.columnPrefix.length).split(Chart.columnDot).join('.');
			nestedProperty.set(obj, path, x[k]);
		}
		return obj;
	}

	@autobind
	private static convertObjectToFlattenColumns(x: Record<string, any>) {
		const columns = {} as Record<string, number>;
		const flatten = (x: Obj, path?: string) => {
			for (const [k, v] of Object.entries(x)) {
				const p = path ? `${path}${this.columnDot}${k}` : k;
				if (typeof v === 'object') {
					flatten(v, p);
				} else {
					columns[this.columnPrefix + p] = v;
				}
			}
		};
		flatten(x);
		return columns;
	}

	@autobind
	private static convertQuery(x: Record<string, any>) {
		const query: Record<string, Function> = {};

		const columns = Chart.convertObjectToFlattenColumns(x);

		for (const [k, v] of Object.entries(columns)) {
			if (v > 0) query[k] = () => `"${k}" + ${v}`;
			if (v < 0) query[k] = () => `"${k}" - ${Math.abs(v)}`;
		}

		return query;
	}

	@autobind
	private static dateToTimestamp(x: Date): Log['date'] {
		return Math.floor(x.getTime() / 1000);
	}

	@autobind
	private static parseDate(date: Date): [number, number, number, number, number, number, number] {
		const y = date.getUTCFullYear();
		const m = date.getUTCMonth();
		const d = date.getUTCDate();
		const h = date.getUTCHours();
		const _m = date.getUTCMinutes();
		const _s = date.getUTCSeconds();
		const _ms = date.getUTCMilliseconds();

		return [y, m, d, h, _m, _s, _ms];
	}

	@autobind
	private static getCurrentDate() {
		return Chart.parseDate(new Date());
	}

	@autobind
	public static schemaToEntity(name: string, schema: Schema): EntitySchema {
		return new EntitySchema({
			name: `__chart__${camelToSnake(name)}`,
			columns: {
				id: {
					type: 'integer',
					primary: true,
					generated: true
				},
				date: {
					type: 'integer',
				},
				group: {
					type: 'varchar',
					length: 128,
					nullable: true
				},
				span: {
					type: 'enum',
					enum: ['hour', 'day']
				},
				unique: {
					type: 'jsonb',
					default: {}
				},
				...Chart.convertSchemaToFlatColumnDefinitions(schema)
			},
			indices: [{
				columns: ['date']
			}, {
				columns: ['span']
			}, {
				columns: ['group']
			}, {
				columns: ['span', 'date']
			}, {
				columns: ['date', 'group']
			}, {
				columns: ['span', 'date', 'group']
			}]
		});
	}

	constructor(name: string, schema: Schema, grouped = false) {
		this.name = name;
		this.schema = schema;
		const entity = Chart.schemaToEntity(name, schema);

		const keys = ['span', 'date'];
		if (grouped) keys.push('group');

		entity.options.uniques = [{
			columns: keys
		}];

		this.repository = getRepository<Log>(entity);
	}

	@autobind
	private getNewLog(latest: T | null): T {
		const log = latest ? this.genNewLog(latest) : {};
		const flatColumns = (x: Obj, path?: string) => {
			for (const [k, v] of Object.entries(x)) {
				const p = path ? `${path}.${k}` : k;
				if (v.type === 'object') {
					flatColumns(v.properties, p);
				} else {
					if (nestedProperty.get(log, p) == null) {
						nestedProperty.set(log, p, 0);
					}
				}
			}
		};
		flatColumns(this.schema.properties!);
		return log as T;
	}

	@autobind
	private getLatestLog(span: Span, group: string | null = null): Promise<Log | null> {
		return this.repository.findOne({
			group: group,
			span: span
		}, {
			order: {
				date: -1
			}
		}).then(x => x || null);
	}

	@autobind
	private async getCurrentLog(span: Span, group: string | null = null): Promise<Log> {
		const [y, m, d, h] = Chart.getCurrentDate();

		const current =
			span == 'day' ? dateUTC([y, m, d, 0]) :
			span == 'hour' ? dateUTC([y, m, d, h]) :
			null as never;

		// 現在(今日または今のHour)のログ
		const currentLog = await this.repository.findOne({
			span: span,
			date: Chart.dateToTimestamp(current),
			...(group ? { group: group } : {})
		});

		// ログがあればそれを返して終了
		if (currentLog != null) {
			return currentLog;
		}

		let log: Log;
		let data: T;

		// 集計期間が変わってから、初めてのチャート更新なら
		// 最も最近のログを持ってくる
		// * 例えば集計期間が「日」である場合で考えると、
		// * 昨日何もチャートを更新するような出来事がなかった場合は、
		// * ログがそもそも作られずドキュメントが存在しないということがあり得るため、
		// * 「昨日の」と決め打ちせずに「もっとも最近の」とします
		const latest = await this.getLatestLog(span, group);

		if (latest != null) {
			const obj = Chart.convertFlattenColumnsToObject(
				latest as Record<string, any>);

			// 空ログデータを作成
			data = this.getNewLog(obj);
		} else {
			// ログが存在しなかったら
			// (Misskeyインスタンスを建てて初めてのチャート更新時など)

			// 初期ログデータを作成
			data = this.getNewLog(null);

			logger.info(`${this.name + (group ? `:${group}` : '')} (${span}): Initial commit created`);
		}

		const date = Chart.dateToTimestamp(current);
		const lockKey = `${this.name}:${date}:${group}:${span}`;

		const unlock = await getChartInsertLock(lockKey);
		try {
			// ロック内でもう1回チェックする
			const currentLog = await this.repository.findOne({
				span: span,
				date: date,
				...(group ? { group: group } : {})
			});

			// ログがあればそれを返して終了
			if (currentLog != null) return currentLog;

			// 新規ログ挿入
			log = await this.repository.save({
				group: group,
				span: span,
				date: date,
				...Chart.convertObjectToFlattenColumns(data)
			});

			logger.info(`${this.name + (group ? `:${group}` : '')} (${span}): New commit created`);

			return log;
		} finally {
			unlock();
		}
	}

	@autobind
	protected commit(query: Record<string, Function>, group: string | null = null, uniqueKey?: string, uniqueValue?: string): Promise<any> {
		const update = async (log: Log) => {
			// ユニークインクリメントの場合、指定のキーに指定の値が既に存在していたら弾く
			if (
				uniqueKey && log.unique &&
				log.unique[uniqueKey] &&
				log.unique[uniqueKey].includes(uniqueValue)
			) return;

			// ユニークインクリメントの指定のキーに値を追加
			if (uniqueKey && log.unique) {
				if (log.unique[uniqueKey]) {
					const sql = `jsonb_set("unique", '{${uniqueKey}}', ("unique"->>'${uniqueKey}')::jsonb || '["${uniqueValue}"]'::jsonb)`;
					query['unique'] = () => sql;
				} else {
					const sql = `jsonb_set("unique", '{${uniqueKey}}', '["${uniqueValue}"]')`;
					query['unique'] = () => sql;
				}
			}

			// ログ更新
			await this.repository.createQueryBuilder()
				.update()
				.set(query)
				.where('id = :id', { id: log.id })
				.execute();
		};

		return Promise.all([
			this.getCurrentLog('day', group).then(log => update(log)),
			this.getCurrentLog('hour', group).then(log => update(log)),
		]);
	}

	@autobind
	public async resync(group: string | null = null): Promise<any> {
		const data = await this.fetchActual(group);

		const update = async (log: Log) => {
			await this.repository.createQueryBuilder()
				.update()
				.set(Chart.convertObjectToFlattenColumns(data))
				.where('id = :id', { id: log.id })
				.execute();
		};

		return Promise.all([
			this.getCurrentLog('day', group).then(log => update(log)),
			this.getCurrentLog('hour', group).then(log => update(log)),
		]);
	}

	@autobind
	protected async inc(inc: DeepPartial<T>, group: string | null = null): Promise<void> {
		await this.commit(Chart.convertQuery(inc as any), group);
	}

	@autobind
	protected async incIfUnique(inc: DeepPartial<T>, key: string, value: string, group: string | null = null): Promise<void> {
		await this.commit(Chart.convertQuery(inc as any), group, key, value);
	}

	@autobind
	public async getChart(span: Span, amount: number, begin: Date | null, group: string | null = null): Promise<ArrayValue<T>> {
		const [y, m, d, h, _m, _s, _ms] = begin ? Chart.parseDate(subtractTime(addTime(begin, 1, span), 1)) : Chart.getCurrentDate();
		const [y2, m2, d2, h2] = begin ? Chart.parseDate(addTime(begin, 1, span)) : [] as never;

		const lt = dateUTC([y, m, d, h, _m, _s, _ms]);

		const gt =
			span === 'day' ? subtractTime(begin ? dateUTC([y2, m2, d2, 0]) : dateUTC([y, m, d, 0]), amount - 1, 'day') :
			span === 'hour' ? subtractTime(begin ? dateUTC([y2, m2, d2, h2]) : dateUTC([y, m, d, h]), amount - 1, 'hour') :
			null as never;

		// ログ取得
		let logs = await this.repository.find({
			where: {
				group: group,
				span: span,
				date: Between(Chart.dateToTimestamp(gt), Chart.dateToTimestamp(lt))
			},
			order: {
				date: -1
			},
		});

		// 要求された範囲にログがひとつもなかったら
		if (logs.length === 0) {
			// もっとも新しいログを持ってくる
			// (すくなくともひとつログが無いと隙間埋めできないため)
			const recentLog = await this.repository.findOne({
				group: group,
				span: span
			}, {
				order: {
					date: -1
				},
			});

			if (recentLog) {
				logs = [recentLog];
			}

		// 要求された範囲の最も古い箇所に位置するログが存在しなかったら
		} else if (!isTimeSame(new Date(logs[logs.length - 1].date * 1000), gt)) {
			// 要求された範囲の最も古い箇所時点での最も新しいログを持ってきて末尾に追加する
			// (隙間埋めできないため)
			const outdatedLog = await this.repository.findOne({
				group: group,
				span: span,
				date: LessThan(Chart.dateToTimestamp(gt))
			}, {
				order: {
					date: -1
				},
			});

			if (outdatedLog) {
				logs.push(outdatedLog);
			}
		}

		const chart: T[] = [];

		// 整形
		for (let i = (amount - 1); i >= 0; i--) {
			const current =
				span === 'day' ? subtractTime(dateUTC([y, m, d, 0]), i, 'day') :
				span === 'hour' ? subtractTime(dateUTC([y, m, d, h]), i, 'hour') :
				null as never;

			const log = logs.find(l => isTimeSame(new Date(l.date * 1000), current));

			if (log) {
				const data = Chart.convertFlattenColumnsToObject(log as Record<string, any>);
				chart.unshift(data);
			} else {
				// 隙間埋め
				const latest = logs.find(l => isTimeBefore(new Date(l.date * 1000), current));
				const data = latest ? Chart.convertFlattenColumnsToObject(latest as Record<string, any>) : null;
				chart.unshift(this.getNewLog(data));
			}
		}

		const res: ArrayValue<T> = {} as any;

		/**
		 * [{ foo: 1, bar: 5 }, { foo: 2, bar: 6 }, { foo: 3, bar: 7 }]
		 * を
		 * { foo: [1, 2, 3], bar: [5, 6, 7] }
		 * にする
		 */
		const dive = (x: Obj, path?: string) => {
			for (const [k, v] of Object.entries(x)) {
				const p = path ? `${path}.${k}` : k;
				if (typeof v == 'object') {
					dive(v, p);
				} else {
					const values = chart.map(s => nestedProperty.get(s, p))
						.map(v => parseInt(v, 10)); // TypeORMのバグ(？)で何故か数値カラムの値が文字列型になっているので数値に戻す
					nestedProperty.set(res, p, values);
				}
			}
		};

		dive(chart[0]);

		return res;
	}
}

export function convertLog(logSchema: Schema): Schema {
	const v: Schema = JSON.parse(JSON.stringify(logSchema)); // copy
	if (v.type === 'number') {
		v.type = 'array';
		v.items = {
			type: 'number' as const,
			optional: false as const, nullable: false as const,
		};
	} else if (v.type === 'object') {
		for (const k of Object.keys(v.properties!)) {
			v.properties![k] = convertLog(v.properties![k]);
		}
	}
	return v;
}
