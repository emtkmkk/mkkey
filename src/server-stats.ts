import * as os from 'os';
const osUtils = require('os-utils');
import * as diskusage from 'diskusage';
import Xev from 'xev';

const ev = new Xev();

/**
 * Report server stats regularly
 */
export default function() {
	const log = [];

	ev.on('requestServerStatsLog', id => {
		ev.emit('serverStatsLog:' + id, log);
	});

	setInterval(() => {
		osUtils.cpuUsage(cpuUsage => {
			const disk = diskusage.checkSync(os.platform() == 'win32' ? 'c:' : '/');
			const stats = {
				cpu_usage: cpuUsage,
				mem: {
					total: os.totalmem(),
					free: os.freemem()
				},
				disk,
				os_uptime: os.uptime(),
				process_uptime: process.uptime()
			};
			ev.emit('serverStats', stats);
			log.push(stats);
			if (log.length > 50) log.shift();
		});
	}, 1000);
}
