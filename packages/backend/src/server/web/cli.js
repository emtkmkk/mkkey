"use strict";

window.onload = async () => {
	const account = JSON.parse(localStorage.getItem("account"));
	const i = account.token;

	const api = (endpoint, data = {}) => {
		const promise = new Promise((resolve, reject) => {
			// Append a credential
			if (i) data.i = i;

			// Send request
			fetch(endpoint.indexOf("://") > -1 ? endpoint : `/api/${endpoint}`, {
				method: "POST",
				body: JSON.stringify(data),
				credentials: "omit",
				cache: "no-cache",
			})
				.then(async (res) => {
					const body = res.status === 204 ? null : await res.json();

					if (res.status === 200) {
						resolve(body);
					} else if (res.status === 204) {
						resolve();
					} else {
						reject(body.error);
					}
				})
				.catch(reject);
		});

		return promise;
	};

	document.getElementById("submit").addEventListener("click", () => {
		api("notes/create", {
			text: document.getElementById("text").value,
		}).then(() => {
			location.reload();
		});
	});
	
	const searchParams = new URLSearchParams(window.location.search)
	
	const notesApi = searchParams.has('api') ? searchParams.get('api') : searchParams.has('tl') ? "notes/" + searchParams.get('tl') + "-timeline" : "notes/timeline";
	const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit'),10) : undefined;
	const noAvatar = searchParams.has('noAvatar')

	api(notesApi,limit ? {limit} : {}).then((notes) => {
		const tl = document.getElementById("tl");
		for (const note of notes) {
			const appearNote = note.renote ? note.renote : note;
			const el = document.createElement("div");
			const header = document.createElement("header");
			const name = document.createElement("p");
			const avatar = document.createElement("img");
			const rtname = document.createElement("p");
			name.textContent = `${appearNote.user.name ? appearNote.user.name + " " : ""}@${appearNote.user.username}${appearNote.user.host ? "@" + appearNote.user.host : ""}`;
			rtname.textContent = `${note.user.name ? note.user.name + " \n" : ""}@${note.user.username}${note.user.host ? "@" + note.user.host : ""}`;
			avatar.src = note.user.avatarUrl;
			avatar.style = "height: 40px";
			const text = document.createElement("div");
			text.textContent = `${(note.cw ? (note.cw + (note.text ? ` (CW 📝${note.text.length})` : "")) : (note.text || "")) + (note.files.length !== 0 ? " (📎" + note.files.length + ")" : "")}${note.renote ? (!note.text ? " RT " : "\nQT ") + name.textContent + " : " + (appearNote.cw ? (appearNote.cw + (appearNote.text ? ` (CW 📝${appearNote.text.length})` : "")) : (appearNote.text || "")) + (appearNote.files.length !== 0 ? " (📎" + appearNote.files.length + ")" : "") : ""}`.trim();
			el.appendChild(header);
			if (!noAvatar) header.appendChild(avatar);
			header.appendChild(rtname);
			if (appearNote.cw || appearNote.text) {
				el.appendChild(text);
			}
			if (appearNote.files) {
				for (const file of appearNote.files) {
					//const img = document.createElement("img");
					//img.src = file.thumbnailUrl;
					//el.appendChild(img);
				}
			}
			tl.appendChild(el);
		}
	});
};
