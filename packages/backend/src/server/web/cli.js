"use strict";

window.onload = async () => {
	createFormToggleLink();
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
			text: document.getElementById("text").value,
			visibility: searchParams.has("v") ? searchParams.get("v") : "public",
			localOnly: searchParams.has("mkkeyPublic") ? !!searchParams.get("mkkeyPublic") : false,
		});
		location.reload();
	});

	const searchParams = new URLSearchParams(window.location.search);

	document.getElementById("submit").textContent = `${document.getElementById("submit").textContent} ${vicon(searchParams.has("v") ? searchParams.get("v") : "public",searchParams.has("mkkeyPublic") ? !!searchParams.get("mkkeyPublic") : false)}`

	const notesApi = searchParams.has('api') ? searchParams.get('api') : searchParams.has("tl") && searchParams.get('tl').replace('home','') ? "notes/" + searchParams.get('tl').replace('home','').replace('social','hybrid') + "-timeline" : "notes/timeline";
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
		if (text.textContent) el.appendChild(text);
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

function createFormToggleLink() {
	const link = document.createElement("a");
	link.href = "#";
	link.textContent = "Show Options Form";
	link.style.display = "block";
	link.style.marginTop = "1em";
	link.onclick = function(e) {
		e.preventDefault();
		createOptionsForm();
	};

	document.body.appendChild(link);
}

function createOptionsForm() {
	// 既にフォームが存在する場合は、それ以上作成しない
	if (document.getElementById("optionsForm")) return;

	// フォームの要素を作成
	const form = document.createElement("form");
	form.id = "optionsForm";

	const tlInput = createInputWithLabel("text", "tl", "Timeline:", "e.g. home | social | local | global");
	const limitInput = createInputWithLabel("number", "limit", "Limit:", "1 - 100");
	const noAvatarCheckbox = createInputWithLabel("checkbox", "noAvatar", "No Avatar:");
	const avatarSizeInput = createInputWithLabel("text", "avatarSize", "Avatar Size:", "e.g. 40");
	const visibilityInput = createInputWithLabel("text", "v", "Visibility:", "public | home | followers");
	const mkkeyPublicCheckbox = createInputWithLabel("checkbox", "mkkeyPublic", "mkkeyPublic:");
	const submitButton = document.createElement("input");
	submitButton.type = "submit";
	submitButton.value = "Apply";

	// フォームに要素を追加
	form.appendChild(tlInput);
	form.appendChild(limitInput);
	form.appendChild(noAvatarCheckbox);
	form.appendChild(avatarSizeInput);
	form.appendChild(visibilityInput);
	form.appendChild(mkkeyPublicCheckbox);
	form.appendChild(submitButton);

	// イベントリスナーを設定
	form.addEventListener('submit', function (e) {
		e.preventDefault();

		const formData = new FormData(e.target);
		const queryParams = new URLSearchParams();

		for (const [key, value] of formData.entries()) {
			if (value && key !== 'submit') queryParams.append(key, value);
		}

		window.location.search = queryParams.toString();
	});

	// フォームをページの下部に追加
	document.body.appendChild(form);
}

function createInputWithLabel(type, name, labelText, placeholder = "", value = "") {
	const searchParams = new URLSearchParams(window.location.search);
	const div = document.createElement("div");
	const label = document.createElement("label");
	const input = document.createElement("input");
	input.type = type;
	input.name = name;
	if (searchParams.has(name) && value) input.value = searchParams.has(name) ? searchParams.get(name) : value;
	if (placeholder) input.placeholder = placeholder;
	label.appendChild(document.createTextNode(labelText));
	label.appendChild(input);
	div.appendChild(label);
	return div;
}

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