"use strict";

window.onload = async () => {
	const account = JSON.parse(localStorage.getItem("account"));
	const i = account.token;

	const api = async (endpoint, data = {}) => {
		if (i) data.i = i;

		const res = await fetch(endpoint.indexOf("://") > -1 ? endpoint : `/api/${endpoint}`, {
			method: "POST",
			body: JSON.stringify(data),
			credentials: "omit",
			cache: "no-cache",
		});

		const body = res.status === 204 ? null : await res.json();
		if (res.ok) return body;

		throw body.error;
	};

	document.getElementById("submit").addEventListener("click", async () => {
		await api("notes/create", {
			text: document.getElementById("text").value
		});
		location.reload();
	});

	const searchParams = new URLSearchParams(window.location.search);

	const notesApi = searchParams.has('api') ? searchParams.get('api') : searchParams.has('tl') ? "notes/" + searchParams.get('tl') + "-timeline" : "notes/timeline";
	const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit'), 10) : undefined;
	const noAvatar = searchParams.has('noAvatar');
	const avatarSize = searchParams.has("avatarSize") ? searchParams.get('avatarSize') : "40";

	const notes = await api(notesApi, limit ? { limit } : {});
	const tl = document.getElementById("tl");

	for (const note of notes) {
		const appearNote = note.renote || note;
		const el = document.createElement("div");
		const header = document.createElement("header");
		const name = createUserLabel(appearNote);
		const rtname = createUserLabel(note);
		const avatar = document.createElement("img");

		avatar.src = note.user.avatarUrl;
		avatar.style.height = avatarSize + "px";
		const text = document.createElement("div");
		text.textContent = formatNoteText(note, appearNote, name);

		el.appendChild(header);
		if (!noAvatar) header.appendChild(avatar);
		header.appendChild(rtname);
		if (appearNote.cw || appearNote.text) el.appendChild(text);
		if (appearNote.files) {
			for (const file of appearNote.files) {
				//const img = document.createElement("img");
				//img.src = file.thumbnailUrl;
				//el.appendChild(img);
			}
		}
		tl.appendChild(el);
	}
};

function createUserLabel(note) {
	const p = document.createElement("p");
	p.textContent = `${getProcessName(note.user.name)} @${note.user.username}${note.user.host ? "@" + note.user.host : ""} ${vicon(note.visibility, note.localOnly)}`.trim();
	return p;
}

function formatNoteText(note, appearNote, name) {
	const noteText = note.cw
		? excludeNotPlain(note.cw) + (note.text ? ` (CW 📝${note.text.length})` : "")
		: excludeNotPlain(note.text) || "";
	const appearText = appearNote.cw
		? excludeNotPlain(appearNote.cw) + (appearNote.text ? ` (CW 📝${appearNote.text.length})` : "")
		: excludeNotPlain(appearNote.text) || "";

	return `${noteText}${note.files.length ? " (📎" + note.files.length + ")" : ""}${note.renote ? (!note.text ? " RT " : " \nQT ") + name.textContent + " : " + appearText + (appearNote.files.length ? " (📎" + appearNote.files.length + ")" : "") : ""}`.trim();
}

function excludeNotPlain(text) {
	return text ? text.replaceAll(/<\/?\w*?>/g, '').replaceAll(/(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*\])?\s*\])?\s*\])?\s*\])/g, '').trim() : undefined;
}

function getProcessName(name) {
	return name ? name.replaceAll(/\s?:[\w_]+?:/g, '').trim() : "";
}

function vicon(v, l) {
	return `${l ? "♥" : ""}${v === "home" ? "🏠" : v === "followers" ? "🔒" : v === "specified" ? "✉" : ""}`;
}