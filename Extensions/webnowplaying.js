// NAME: WebNowPlaying
// AUTHOR: khanhas, keifufu (based on https://github.com/keifufu/WebNowPlaying-Redux)
// DESCRIPTION: Provides media information and controls to WebNowPlaying-Redux-Rainmeter, but also supports WebNowPlaying for Rainmeter 0.5.0 and older.

/// <reference path="../globals.d.ts" />

(function WebNowPlaying() {
	if (!Spotifier.CosmosAsync || !Spotifier.Platform.LibraryAPI) {
		setTimeout(WebNowPlaying, 500);
		return;
	}

	const socket = new WNPReduxWebSocket();
	window.addEventListener("beforeunload", () => {
		socket.close();
	});
})();

class WNPReduxWebSocket {
	_ws = null;
	cache = new Map();
	reconnectCount = 0;
	updateInterval = null;
	communicationRevision = null;
	connectionTimeout = null;
	reconnectTimeout = null;
	isClosed = false;
	spotifierInfo = {
		player: "Spotify Desktop",
		state: "STOPPED",
		title: "",
		artist: "",
		album: "",
		cover: "",
		duration: "0:00",
		// position and volume are fetched in sendUpdate()
		position: "0:00",
		volume: 100,
		rating: 0,
		repeat: "NONE",
		shuffle: false,
	};

	constructor() {
		this.init();

		Spotifier.Player.addEventListener("songchange", ({ data }) => this.updateSpotifierInfo(data));
		Spotifier.Player.addEventListener("onplaypause", ({ data }) => this.updateSpotifierInfo(data));
	}

	updateSpotifierInfo(data) {
		if (!data?.item?.metadata) return;
		const meta = data.item.metadata;
		this.spotifierInfo.title = meta.title;
		this.spotifierInfo.album = meta.album_title;
		this.spotifierInfo.duration = timeInSecondsToString(Math.round(Number.parseInt(meta.duration) / 1000));
		this.spotifierInfo.state = !data.isPaused ? "PLAYING" : "PAUSED";
		this.spotifierInfo.repeat = data.repeat === 2 ? "ONE" : data.repeat === 1 ? "ALL" : "NONE";
		this.spotifierInfo.shuffle = data.shuffle;
		this.spotifierInfo.artist = meta.artist_name;
		let artistCount = 1;
		while (meta[`artist_name:${artistCount}`]) {
			this.spotifierInfo.artist += `, ${meta[`artist_name:${artistCount}`]}`;
			artistCount++;
		}
		if (!this.spotifierInfo.artist) this.spotifierInfo.artist = meta.album_title; // Podcast

		Spotifier.Platform.LibraryAPI.contains(data.item.uri).then(([added]) => {
			this.spotifierInfo.rating = added ? 5 : 0;
		});

		const cover = meta.image_xlarge_url;
		if (cover?.indexOf("localfile") === -1) this.spotifierInfo.cover = `https://i.scdn.co/image/${cover.substring(cover.lastIndexOf(":") + 1)}`;
		else this.spotifierInfo.cover = "";
	}

	init() {
		try {
			this._ws = new WebSocket("ws://localhost:8974");
			this._ws.onopen = this.onOpen.bind(this);
			this._ws.onclose = this.onClose.bind(this);
			this._ws.onerror = this.onError.bind(this);
			this._ws.onmessage = this.onMessage.bind(this);
		} catch {
			this.retry();
		}
	}

	close(cleanupOnly = false) {
		if (!cleanupOnly) this.isClosed = true;
		this.cache = new Map();
		this.communicationRevision = null;
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
		}
	}

	// Clean up old variables and retry connection
	retry() {
		if (this.isClosed) return;
		this.close(true);
		// Reconnects once per second for 30 seconds, then with a exponential backoff of (2^reconnectAttempts) up to 60 seconds
		this.reconnectTimeout = setTimeout(
			() => {
				this.init();
				this.reconnectAttempts += 1;
			},
			Math.min(1000 * (this.reconnectAttempts <= 30 ? 1 : 2 ** (this.reconnectAttempts - 30)), 60000)
		);
	}

	send(data) {
		if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
		this._ws.send(data);
	}

	onOpen() {
		this.reconnectCount = 0;
		this.updateInterval = setInterval(this.sendUpdate.bind(this), 500);
		// If no communication revision is received within 1 second, assume it's WNP for Rainmeter < 0.5.0 (legacy)
		this.connectionTimeout = setTimeout(() => {
			if (this.communicationRevision === null) this.communicationRevision = "legacy";
		}, 1000);
	}

	onClose() {
		this.retry();
	}

	onError() {
		this.retry();
	}

	onMessage(event) {
		if (this.communicationRevision) {
			switch (this.communicationRevision) {
				case "legacy":
					OnMessageLegacy(this, event.data);
					break;
				case "1":
					OnMessageRev1(this, event.data);
					break;
			}

			// Sending an update immediately would normally do nothing, as it takes some time for
			// spotifierInfo to be updated via the Cosmos subscription. However, we try to
			// optimistically update spotifierInfo after receiving events.
			this.sendUpdate();
		} else {
			if (event.data.startsWith("Version:")) {
				// 'Version:' WNP for Rainmeter 0.5.0 (legacy)
				this.communicationRevision = "legacy";
			} else if (event.data.startsWith("ADAPTER_VERSION ")) {
				// Any WNPRedux adapter will send 'ADAPTER_VERSION <version>;WNPRLIB_REVISION <revision>' after connecting
				this.communicationRevision = event.data.split(";")[1].split(" ")[1];
			} else {
				// The first message wasn't version related, so it's probably WNP for Rainmeter < 0.5.0 (legacy)
				this.communicationRevision = "legacy";
			}
		}
	}

	sendUpdate() {
		if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
		switch (this.communicationRevision) {
			case "legacy":
				SendUpdateLegacy(this);
				break;
			case "1":
				SendUpdateRev1(this);
				break;
		}
	}
}

function OnMessageLegacy(self, message) {
	// Quite lengthy functions because we optimistically update spotifierInfo after receiving events.
	try {
		const [type, data] = message.toUpperCase().split(" ");
		switch (type) {
			case "PLAYPAUSE": {
				Spotifier.Player.togglePlay();
				self.spotifierInfo.state = self.spotifierInfo.state === "PLAYING" ? "PAUSED" : "PLAYING";
				break;
			}
			case "NEXT":
				Spotifier.Player.next();
				break;
			case "PREVIOUS":
				Spotifier.Player.back();
				break;
			case "SETPOSITION": {
				// Example string: SetPosition 34:SetProgress 0,100890207715134:
				const [, positionPercentage] = message.toUpperCase().split(":")[1].split("SETPROGRESS ");
				Spotifier.Player.seek(Number.parseFloat(positionPercentage.replace(",", ".")));
				break;
			}
			case "SETVOLUME":
				Spotifier.Player.setVolume(Number.parseInt(data) / 100);
				break;
			case "REPEAT": {
				Spotifier.Player.toggleRepeat();
				self.spotifierInfo.repeat = self.spotifierInfo.repeat === "NONE" ? "ALL" : self.spotifierInfo.repeat === "ALL" ? "ONE" : "NONE";
				break;
			}
			case "SHUFFLE": {
				Spotifier.Player.toggleShuffle();
				self.spotifierInfo.shuffle = !self.spotifierInfo.shuffle;
				break;
			}
			case "TOGGLETHUMBSUP": {
				Spotifier.Player.toggleHeart();
				self.spotifierInfo.rating = self.spotifierInfo.rating === 5 ? 0 : 5;
				break;
			}
			// Spotify doesn't have a negative rating
			// case 'TOGGLETHUMBSDOWN': break
			case "RATING": {
				const rating = Number.parseInt(data);
				const isLiked = self.spotifierInfo.rating > 3;
				if (rating >= 3 && !isLiked) Spotifier.Player.toggleHeart();
				else if (rating < 3 && isLiked) Spotifier.Player.toggleHeart();
				self.spotifierInfo.rating = rating;
				break;
			}
		}
	} catch (e) {
		self.send(`Error:Error sending event to ${self.spotifierInfo.player}`);
		self.send(`ErrorD:${e}`);
	}
}

function SendUpdateLegacy(self) {
	if (!Spotifier.Player.data && cache.get("state") !== 0) {
		cache.set("state", 0);
		ws.send("STATE:0");
		return;
	}

	self.spotifierInfo.position = timeInSecondsToString(Math.round(Spotifier.Player.getProgress() / 1000));
	self.spotifierInfo.volume = Math.round(Spotifier.Player.getVolume() * 100);

	for (const key of Object.keys(self.spotifierInfo)) {
		try {
			let value = self.spotifierInfo[key];
			// For numbers, round it to an integer
			if (typeof value === "number") value = Math.round(value);

			// Conversion to legacy values
			if (key === "state") value = value === "PLAYING" ? 1 : value === "PAUSED" ? 2 : 0;
			else if (key === "repeat") value = value === "ALL" ? 2 : value === "ONE" ? 1 : 0;
			else if (key === "shuffle") value = value ? 1 : 0;

			// Check for null, and not just falsy, because 0 and '' are falsy
			if (value !== null && value !== self.cache.get(key)) {
				self.send(`${key.toUpperCase()}:${value}`);
				self.cache.set(key, value);
			}
		} catch (e) {
			self.send(`Error: Error updating ${key} for ${self.spotifierInfo.player}`);
			self.send(`ErrorD:${e}`);
		}
	}
}

function OnMessageRev1(self, message) {
	// Quite lengthy functions because we optimistically update spotifierInfo after receiving events.
	const [type, data] = message.split(" ");

	try {
		switch (type) {
			case "TOGGLE_PLAYING": {
				Spotifier.Player.togglePlay();
				self.spotifierInfo.state = self.spotifierInfo.state === "PLAYING" ? "PAUSED" : "PLAYING";
				break;
			}
			case "NEXT":
				Spotifier.Player.next();
				break;
			case "PREVIOUS":
				Spotifier.Player.back();
				break;
			case "SET_POSITION": {
				const [, positionPercentage] = data.split(":");
				Spotifier.Player.seek(Number.parseFloat(positionPercentage.replace(",", ".")));
				break;
			}
			case "SET_VOLUME":
				Spotifier.Player.setVolume(Number.parseInt(data) / 100);
				break;
			case "TOGGLE_REPEAT": {
				Spotifier.Player.toggleRepeat();
				self.spotifierInfo.repeat = self.spotifierInfo.repeat === "NONE" ? "ALL" : self.spotifierInfo.repeat === "ALL" ? "ONE" : "NONE";
				break;
			}
			case "TOGGLE_SHUFFLE": {
				Spotifier.Player.toggleShuffle();
				self.spotifierInfo.shuffle = !self.spotifierInfo.shuffle;
				break;
			}
			case "TOGGLE_THUMBS_UP": {
				Spotifier.Player.toggleHeart();
				self.spotifierInfo.rating = self.spotifierInfo.rating === 5 ? 0 : 5;
				break;
			}
			// Spotify doesn't have a negative rating
			// case 'TOGGLE_THUMBS_DOWN': break
			case "SET_RATING": {
				const rating = Number.parseInt(data);
				const isLiked = self.spotifierInfo.rating > 3;
				if (rating >= 3 && !isLiked) Spotifier.Player.toggleHeart();
				else if (rating < 3 && isLiked) Spotifier.Player.toggleHeart();
				self.spotifierInfo.rating = rating;
				break;
			}
		}
	} catch (e) {
		self.send(`ERROR Error sending event to ${self.spotifierInfo.player}`);
		self.send(`ERRORDEBUG ${e}`);
	}
}

function SendUpdateRev1(self) {
	if (!Spotifier.Player.data && cache.get("state") !== "STOPPED") {
		cache.set("state", "STOPPED");
		ws.send("STATE STOPPED");
		return;
	}

	self.spotifierInfo.position = timeInSecondsToString(Math.round(Spotifier.Player.getProgress() / 1000));
	self.spotifierInfo.volume = Math.round(Spotifier.Player.getVolume() * 100);

	for (const key of Object.keys(self.spotifierInfo)) {
		try {
			let value = self.spotifierInfo[key];
			// For numbers, round it to an integer
			if (typeof value === "number") value = Math.round(value);
			// Check for null, and not just falsy, because 0 and '' are falsy
			if (value !== null && value !== self.cache.get(key)) {
				self.send(`${key.toUpperCase()} ${value}`);
				self.cache.set(key, value);
			}
		} catch (e) {
			self.send(`ERROR Error updating ${key} for ${self.spotifierInfo.player}`);
			self.send(`ERRORDEBUG ${e}`);
		}
	}
}

// Convert seconds to a time string acceptable to Rainmeter
function pad(num, size) {
	return num.toString().padStart(size, "0");
}
function timeInSecondsToString(timeInSeconds) {
	const timeInMinutes = Math.floor(timeInSeconds / 60);
	if (timeInMinutes < 60) return `${timeInMinutes}:${pad(Math.floor(timeInSeconds % 60), 2)}`;

	return `${Math.floor(timeInMinutes / 60)}:${pad(Math.floor(timeInMinutes % 60), 2)}:${pad(Math.floor(timeInSeconds % 60), 2)}`;
}
