import { waitFor } from "./shared/async.js";

(function waitOrigins() {
  if (!Spotifier?.Player?.origin?._state) {
    setTimeout(waitOrigins, 10);
    return;
  }

  const playerState = {
    cache: null,
    current: null,
  };

  const interval = setInterval(() => {
    if (!Spotifier.Player.origin._state?.item) return;
    Spotifier.Player.data = Spotifier.Player.origin._state;
    playerState.cache = Spotifier.Player.data;
    clearInterval(interval);
  }, 10);

  Spotifier.Player.origin._events.addListener("update", ({ data: playerEventData }) => {
    playerState.current = playerEventData.item ? playerEventData : null;
    Spotifier.Player.data = playerState.current;

    if (playerState.cache?.item?.uri !== playerState.current?.item?.uri) {
      const event = new Event("songchange");
      event.data = Spotifier.Player.data;
      Spotifier.Player.dispatchEvent(event);
    }

    if (playerState.cache?.isPaused !== playerState.current?.isPaused) {
      const event = new Event("onplaypause");
      event.data = Spotifier.Player.data;
      Spotifier.Player.dispatchEvent(event);
    }

    playerState.cache = playerState.current;
  });

  (function waitProductStateAPI() {
    if (!Spotifier.Platform?.UserAPI) {
      setTimeout(waitProductStateAPI, 100);
      return;
    }

    const productState = Spotifier.Platform.UserAPI._product_state || Spotifier.Platform.UserAPI._product_state_service;
    if (productState) return;

    const productStateApi = Spotifier.Platform?.ProductStateAPI?.productStateApi;
    if (!productStateApi) {
      setTimeout(waitProductStateAPI, 100);
      return;
    }

    Spotifier.Platform.UserAPI._product_state_service = productStateApi;
  })();

  void (async function setButtonsHeight() {
    const CosmosAsync = await waitFor(() => Spotifier.CosmosAsync, 100);
    const expFeatures = JSON.parse(localStorage.getItem("spotifier-exp-features") || "{}");
    const isGlobalNavbar = expFeatures?.enableGlobalNavBar?.value;

    if (typeof isGlobalNavbar !== "undefined" && isGlobalNavbar === "control") {
      await CosmosAsync.post("sp://messages/v1/container/control", {
        type: "update_titlebar",
        height: Spotifier.Platform.PlatformData.os_name === "osx" ? "42" : "40",
      });
    }
  })();

  setInterval(() => {
    if (playerState.cache?.isPaused === false) {
      const event = new Event("onprogress");
      event.data = Spotifier.Player.getProgress();
      Spotifier.Player.dispatchEvent(event);
    }
  }, 100);

  Spotifier.addToQueue = (uri) => {
    return Spotifier.Player.origin._queue?.addToQueue(uri);
  };
  Spotifier.removeFromQueue = (uri) => {
    return Spotifier.Player.origin._queue?.removeFromQueue(uri);
  };
})();
