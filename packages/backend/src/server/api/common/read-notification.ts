import { In, LessThanOrEqual } from "typeorm";
import { publishMainStream } from "@/services/stream.js";
import { pushNotification } from "@/services/push-notification.js";
import Logger from "@/services/logger.js";
import type { User } from "@/models/entities/user.js";
import type { Notification } from "@/models/entities/notification.js";
import { Notifications, Users } from "@/models/index.js";
import { redisClient } from "@/db/redis.js";
import config from "@/config/index.js";

const LATEST_READ_NOTIFICATION_TTL_SECONDS = 86400;
const readNotificationLogger = new Logger("read-notification");

export async function readNotification(
	userId: User["id"],
	notificationIds: Notification["id"][],
) {
	if (notificationIds.length === 0) return;

	// Update documents
	const result = await Notifications.update(
		{
			notifieeId: userId,
			id: In(notificationIds),
			isRead: false,
		},
		{
			isRead: true,
		},
	);

	if (result.affected === 0) return;

	if (!(await Users.getHasUnreadNotification(userId))) {
		await updateLatestReadNotificationByIds(userId, notificationIds);
		return postReadAllNotifications(userId);
	} else {
		return postReadNotifications(userId, notificationIds);
	}
}

export async function readAllNotifications(
	userId: User["id"],
	latestNotificationId: Notification["id"],
) {
	const cacheKey = getLatestReadNotificationCacheKey(userId);
	const cachedLatestReadNotification = await redisClient.get(cacheKey);
	if (cachedLatestReadNotification != null) {
		const compared = compareNotificationIds(
			latestNotificationId,
			cachedLatestReadNotification,
		);

		if (compared != null && compared <= 0) {
			readNotificationLogger.info(
				"readAllNotifications skipped by cache",
				{
					userId,
					latestNotificationId,
					cachedLatestReadNotification,
				},
			);
			return;
		}

		if (compared == null) {
			readNotificationLogger.warn(
				"readAllNotifications cache fallback due to invalid cache value",
				{
					userId,
					latestNotificationId,
					cachedLatestReadNotification,
				},
			);
		}
	}

	const result = await Notifications.update(
		{
			notifieeId: userId,
			id: LessThanOrEqual(latestNotificationId),
			isRead: false,
		},
		{
			isRead: true,
		},
	);

	if (result.affected === 0) return;

	await updateLatestReadNotificationCache(userId, latestNotificationId);

	return postReadAllNotifications(userId);
}

export async function readNotificationByQuery(
	userId: User["id"],
	query: Record<string, any>,
) {
	const notificationIds = await Notifications.findBy({
		...query,
		notifieeId: userId,
		isRead: false,
	}).then((notifications) =>
		notifications.map((notification) => notification.id),
	);

	return readNotification(userId, notificationIds);
}

function postReadAllNotifications(userId: User["id"]) {
	publishMainStream(userId, "readAllNotifications");
	return pushNotification(userId, "readAllNotifications", undefined);
}

function postReadNotifications(
	userId: User["id"],
	notificationIds: Notification["id"][],
) {
	publishMainStream(userId, "readNotifications", notificationIds);
	return pushNotification(userId, "readNotifications", { notificationIds });
}

function getLatestReadNotificationCacheKey(userId: User["id"]) {
	return `latestReadNotification:${userId}`;
}

async function updateLatestReadNotificationByIds(
	userId: User["id"],
	notificationIds: Notification["id"][],
) {
	let latestReadNotificationId: Notification["id"] | null = null;

	for (const notificationId of notificationIds) {
		if (latestReadNotificationId == null) {
			latestReadNotificationId = notificationId;
			continue;
		}

		const compared = compareNotificationIds(notificationId, latestReadNotificationId);
		if (compared == null) {
			readNotificationLogger.warn(
				"skip latestReadNotification cache update because notification id is not comparable",
				{
					userId,
					notificationId,
					latestReadNotificationId,
				},
			);
			return;
		}

		if (compared > 0) {
			latestReadNotificationId = notificationId;
		}
	}

	if (latestReadNotificationId == null) return;

	await updateLatestReadNotificationCache(userId, latestReadNotificationId);
}

async function updateLatestReadNotificationCache(
	userId: User["id"],
	latestNotificationId: Notification["id"],
) {
	await redisClient.set(
		getLatestReadNotificationCacheKey(userId),
		latestNotificationId,
		"EX",
		LATEST_READ_NOTIFICATION_TTL_SECONDS,
	);
}

function compareNotificationIds(
	a: Notification["id"],
	b: Notification["id"],
): -1 | 0 | 1 | null {
	const idMethod = config.id.toLowerCase();

	if (!isComparableNotificationId(a, idMethod) || !isComparableNotificationId(b, idMethod)) {
		return null;
	}

	if (a === b) return 0;
	return a < b ? -1 : 1;
}

function isComparableNotificationId(notificationId: string, idMethod: string) {
	switch (idMethod) {
		case "aid":
			return /^[0-9a-z]{10}$/.test(notificationId);
		case "meid":
			return /^[0-9a-f]{24}$/.test(notificationId);
		case "meidg":
			return /^g[0-9a-f]{23}$/.test(notificationId);
		case "ulid":
			return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(notificationId);
		case "objectid":
			return /^[0-9a-f]{24}$/.test(notificationId);
		default:
			return false;
	}
}
