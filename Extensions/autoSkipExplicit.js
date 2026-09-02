// NAME: Christian Spotify
// AUTHOR: khanhas
// DESCRIPTION: Auto skip explicit songs. Toggle in Profile menu.

/// <reference path="../globals.d.ts" />

(async function ChristianSpotify() {
	if (!Spotifier.LocalStorage) {
		setTimeout(ChristianSpotify, 1000);
		return;
	}
	await new Promise((res) => Spotifier.Events.webpackLoaded.on(res));

	let isEnabled = Spotifier.LocalStorage.get("ChristianMode") === "1";

	new Spotifier.Menu.Item("Christian mode", isEnabled, (self) => {
		isEnabled = !isEnabled;
		Spotifier.LocalStorage.set("ChristianMode", isEnabled ? "1" : "0");
		self.setState(isEnabled);
	}).register();

	Spotifier.Player.addEventListener("songchange", () => {
		if (!isEnabled) return;
		const data = Spotifier.Player.data || Spotifier.Queue;
		if (!data) return;

		const isExplicit = data.item.metadata.is_explicit;
		if (isExplicit === "true") {
			Spotifier.Player.next();
		}
	});
})();
