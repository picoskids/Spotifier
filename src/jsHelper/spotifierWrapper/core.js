window.Spotifier = {
  Player: {
    addEventListener: (type, callback) => {
      if (!(type in Spotifier.Player.eventListeners)) {
        Spotifier.Player.eventListeners[type] = [];
      }
      Spotifier.Player.eventListeners[type].push(callback);
    },
    dispatchEvent: (event) => {
      if (!(event.type in Spotifier.Player.eventListeners)) {
        return true;
      }
      const stack = Spotifier.Player.eventListeners[event.type];
      for (let i = 0; i < stack.length; i++) {
        if (typeof stack[i] === "function") {
          stack[i](event);
        }
      }
      return !event.defaultPrevented;
    },
    eventListeners: {},
    seek: (p) => {
      const duration = !Number.isInteger(p) && p >= 0 && p <= 1 ? Math.round(p * Spotifier.Player.origin._state.duration) : p;
      Spotifier.Player.origin.seekTo(duration);
    },
    getProgress: () => {
      const state = Spotifier.Player.origin._state;
      return (state.isPaused ? 0 : Date.now() - state.timestamp) + state.positionAsOfTimestamp;
    },
    getProgressPercent: () => {
      const state = Spotifier.Player.origin._state;
      return Spotifier.Player.getProgress() / state.duration;
    },
    getDuration: () => Spotifier.Player.origin._state.duration,
    setVolume: (v) => {
      Spotifier.Platform.PlaybackAPI.setVolume(v);
    },
    increaseVolume: () => {
      Spotifier.Platform.PlaybackAPI.raiseVolume();
    },
    decreaseVolume: () => {
      Spotifier.Platform.PlaybackAPI.lowerVolume();
    },
    getVolume: () => Spotifier.Platform.PlaybackAPI._volume,
    next: () => {
      Spotifier.Player.origin.skipToNext();
    },
    back: () => {
      Spotifier.Player.origin.skipToPrevious();
    },
    togglePlay: () => {
      if (Spotifier.Player.isPlaying()) Spotifier.Player.pause();
      else Spotifier.Player.play();
    },
    isPlaying: () => !Spotifier.Player.origin._state.isPaused,
    toggleShuffle: () => {
      Spotifier.Player.origin.setShuffle(!Spotifier.Player.origin._state.shuffle);
    },
    getShuffle: () => Spotifier.Player.origin._state.shuffle,
    setShuffle: (b) => {
      Spotifier.Player.origin.setShuffle(b);
    },
    toggleRepeat: () => {
      Spotifier.Player.origin.setRepeat((Spotifier.Player.origin._state.repeat + 1) % 3);
    },
    getRepeat: () => Spotifier.Player.origin._state.repeat,
    setRepeat: (r) => {
      Spotifier.Player.origin.setRepeat(r);
    },
    getMute: () => Spotifier.Player.getVolume() === 0,
    toggleMute: () => {
      Spotifier.Player.setMute(!Spotifier.Player.getMute());
    },
    setMute: (b) => {
      if (b !== Spotifier.Player.getMute()) {
        document.querySelector(".volume-bar__icon-button")?.click();
      }
    },
    formatTime: (ms) => {
      let seconds = Math.floor(ms / 1e3);
      const minutes = Math.floor(seconds / 60);
      seconds -= minutes * 60;
      return `${minutes}:${seconds > 9 ? "" : "0"}${String(seconds)}`;
    },
    getHeart: () => Spotifier.Player.origin._state.item?.metadata["collection.in_collection"] === "true",
    pause: () => {
      Spotifier.Player.origin.pause();
    },
    play: () => {
      Spotifier.Player.origin.resume();
    },
    playUri: async (uri, context = {}, options = {}) => {
      return await Spotifier.Player.origin.play({ uri: uri }, context, options);
    },
    removeEventListener: (type, callback) => {
      if (!(type in Spotifier.Player.eventListeners)) return;
      const stack = Spotifier.Player.eventListeners[type];
      for (let i = 0; i < stack.length; i++) {
        if (stack[i] === callback) {
          stack.splice(i, 1);
          return;
        }
      }
    },
    skipBack: (amount = 15e3) => {
      Spotifier.Player.origin.seekBackward(amount);
    },
    skipForward: (amount = 15e3) => {
      Spotifier.Player.origin.seekForward(amount);
    },
    setHeart: (b) => {
      const uris = [Spotifier.Player.origin._state.item.uri];
      if (b) {
        Spotifier.Platform.LibraryAPI.add({ uris });
      } else {
        Spotifier.Platform.LibraryAPI.remove({ uris });
      }
    },
    toggleHeart: () => {
      Spotifier.Player.setHeart(!Spotifier.Player.getHeart());
    },
  },
  test: () => {
    function checkObject(object) {
      const { objectToCheck, methods, name } = object;
      let count = methods.size;

      for (const method of methods) {
        if (objectToCheck[method] === undefined || objectToCheck[method] === null) {
          console.error(`${name}.${method} is not available. Please open an issue in the Spotifier repository to inform us about it.`);
          count--;
        }
      }
      console.log(`${count}/${methods.size} ${name} methods and objects are OK.`);

      for (const key of Object.keys(objectToCheck)) {
        if (!methods.has(key)) {
          console.warn(`${name} method ${key} exists but is not in the method list. Consider adding it.`);
        }
      }
    }

    const objectsToCheck = new Set([
      {
        objectToCheck: Spotifier,
        name: "Spotifier",
        methods: new Set([
          "Player",
          "addToQueue",
          "CosmosAsync",
          "getAudioData",
          "Keyboard",
          "URI",
          "LocalStorage",
          "Queue",
          "removeFromQueue",
          "showNotification",
          "Menu",
          "ContextMenu",
          "React",
          "Mousetrap",
          "Locale",
          "ReactDOM",
          "Topbar",
          "ReactComponent",
          "PopupModal",
          "SVGIcons",
          "colorExtractor",
          "test",
          "Platform",
          "_platform",
          "Config",
          "expFeatureOverride",
          "createInternalMap",
          "RemoteConfigResolver",
          "Playbar",
          "Tippy",
          "_getStyledClassName",
          "GraphQL",
          "ReactHook",
          "AppTitle",
          "_reservedPanelIds",
          "ReactFlipToolkit",
          "classnames",
          "ReactQuery",
          "Color",
          "extractColorPreset",
          "ReactDOMServer",
          "Snackbar",
          "ContextMenuV2",
          "ReactJSX",
          "_renderNavLinks",
          "Events",
        ]),
      },
      {
        objectToCheck: Spotifier.Player,
        name: "Spotifier.Player",
        methods: new Set([
          "addEventListener",
          "back",
          "data",
          "decreaseVolume",
          "dispatchEvent",
          "eventListeners",
          "formatTime",
          "getDuration",
          "getHeart",
          "getMute",
          "getProgress",
          "getProgressPercent",
          "getRepeat",
          "getShuffle",
          "getVolume",
          "increaseVolume",
          "isPlaying",
          "next",
          "pause",
          "play",
          "removeEventListener",
          "seek",
          "setMute",
          "setRepeat",
          "setShuffle",
          "setVolume",
          "skipBack",
          "skipForward",
          "toggleHeart",
          "toggleMute",
          "togglePlay",
          "toggleRepeat",
          "toggleShuffle",
          "origin",
          "playUri",
          "setHeart",
        ]),
      },
      {
        objectToCheck: Spotifier.ReactComponent,
        name: "Spotifier.ReactComponent",
        methods: new Set([
          "RightClickMenu",
          "ContextMenu",
          "Menu",
          "MenuItem",
          "AlbumMenu",
          "PodcastShowMenu",
          "ArtistMenu",
          "PlaylistMenu",
          "TrackMenu",
          "TooltipWrapper",
          "TextComponent",
          "IconComponent",
          "ConfirmDialog",
          "Slider",
          "RemoteConfigProvider",
          "ButtonPrimary",
          "ButtonSecondary",
          "ButtonTertiary",
          "Snackbar",
          "Chip",
          "Toggle",
          "Cards",
          "Router",
          "Routes",
          "Route",
          "StoreProvider",
          "PlatformProvider",
          "Dropdown",
          "MenuSubMenuItem",
          "Navigation",
          "ScrollableContainer",
        ]),
      },
      {
        objectToCheck: Spotifier.ReactComponent.Cards,
        name: "Spotifier.ReactComponent.Cards",
        methods: new Set([
          "Default",
          "Hero",
          "CardImage",
          "Album",
          "Artist",
          "Audiobook",
          "Episode",
          "Playlist",
          "Profile",
          "Show",
          "Track",
          "FeatureCard",
        ]),
      },
      {
        objectToCheck: Spotifier.ReactHook,
        name: "Spotifier.ReactHook",
        methods: new Set(["DragHandler", "useExtractedColor"]),
      },
    ]);

    for (const object of objectsToCheck) {
      checkObject(object);
    }
  },
  GraphQL: {
    Definitions: {},
  },
  ReactComponent: {},
  ReactHook: {},
  ReactFlipToolkit: {},
  Snackbar: {},
  Platform: {},
};
