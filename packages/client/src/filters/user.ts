import * as misskey from "calckey-js";
import * as Acct from "calckey-js/built/acct";
import { url } from "@/config";
import getUserName from "@/scripts/get-user-name";

export const acct = (user: misskey.Acct) => {
	return Acct.toString(user);
};

export const userName = (user: misskey.entities.User) => {
	return getUserName(user, true);
};

export const userPage = (user: misskey.Acct, path?, absolute = false) => {
	return `${absolute ? url : ""}/@${acct(user)}${path ? `/${path}` : ""}`;
};
