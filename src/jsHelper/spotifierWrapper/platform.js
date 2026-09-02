import { waitFor } from "./shared/async.js";

(function waitForPlatform() {
  if (!Spotifier._platform) {
    setTimeout(waitForPlatform, 50);
    return;
  }
  const { _platform } = Spotifier;
  for (const key of Object.keys(_platform)) {
    if (key.startsWith("get") && typeof _platform[key] === "function") {
      Spotifier.Platform[key.slice(3)] = _platform[key]();
    } else {
      Spotifier.Platform[key] = _platform[key];
    }
  }
})();

(function addMissingPlatformAPIs() {
  if (!Spotifier.Platform?.version && !Spotifier.Platform?.Registry) {
    setTimeout(addMissingPlatformAPIs, 50);
    return;
  }
  const os = Spotifier.Platform.operatingSystem;
  const version = Spotifier.Platform.version.split(".").map((i) => Number.parseInt(i, 10));
  if (version[0] === 1 && version[1] === 2 && version[2] < 38) return;

  for (const [key, _] of Spotifier.Platform.Registry._map.entries()) {
    if (typeof key?.description !== "string" || !key?.description.endsWith("API")) continue;
    const symbolName = key.description;
    if (symbolName === "ExclusiveModeAPI" && os === "Linux") continue;
    if (Object.hasOwn(Spotifier.Platform, symbolName)) continue;
    try {
      const resolvedAPI = Spotifier.Platform.Registry.resolve(key);
      Spotifier.Platform[symbolName] = resolvedAPI;

      console.debug(`[spotifierWrapper] Resolved PlatformAPI from Registry: ${symbolName}`);
    } catch (err) {
      console.error(`[spotifierWrapper] Error resolving PlatformAPI from Registry: ${symbolName}`, err);
    }
  }
})();

// Based on https://blog.aziz.tn/2025/01/spotify-fix-lagging-issue-on-scrolling.html
function applyScrollingFix() {
  if (!Spotifier.Platform?.version) {
    setTimeout(applyScrollingFix, 50);
    return;
  }

  // Run only for 1.2.56 and lower
  const version = Spotifier.Platform.version.split(".").map((i) => Number.parseInt(i, 10));
  if (version[1] >= 2 && version[2] >= 57) return;

  const scrollableElements = Array.from(document.querySelectorAll("*:not([data-scroll-optimized])")).filter((el) => {
    if (
      el.id === "context-menu" ||
      el.closest("#context-menu") ||
      el.getAttribute("role") === "dialog" ||
      el.classList.contains("popup") ||
      el.getAttribute("aria-haspopup") === "true"
    )
      return false;

    const style = window.getComputedStyle(el);
    return style.overflow === "auto" || style.overflow === "scroll" || style.overflowY === "auto" || style.overflowY === "scroll";
  });

  for (const el of scrollableElements) {
    el.style.willChange = "transform";
    el.style.transform = "translate3d(0, 0, 0)";
    el.setAttribute("data-scroll-optimized", "true");
  }
}

let scrollingFixScheduled = false;
function scheduleScrollingFix() {
  if (scrollingFixScheduled) return;
  scrollingFixScheduled = true;
  queueMicrotask(() => {
    scrollingFixScheduled = false;
    applyScrollingFix();
  });
}

const observer = new MutationObserver(scheduleScrollingFix);

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
});

const originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  originalPushState(...args);
  setTimeout(applyScrollingFix, 100);
};

window.addEventListener("popstate", () => {
  setTimeout(applyScrollingFix, 100);
});

applyScrollingFix();

void (async function addProxyCosmos() {
  if (!Spotifier.Player.origin?._cosmos && !Spotifier.Platform?.Registry) {
    setTimeout(addProxyCosmos, 50);
    return;
  }

  const _cosmos = Spotifier.Player.origin?._cosmos ?? Spotifier.Platform?.Registry.resolve(Symbol.for("Cosmos"));

  const allowedMethodsMap = {
    get: "get",
    post: "post",
    del: "delete",
    put: "put",
    patch: "patch",
  };
  const allowedMethodsSet = new Set(Object.keys(allowedMethodsMap));
  const internalEndpoints = new Set(["sp:", "wg:"]);

  const handler = {
    get: (target, prop, receiver) => {
      const internalFetch = Reflect.get(target, prop, receiver);

      if (typeof internalFetch !== "function" || !allowedMethodsSet.has(prop)) return internalFetch;
      const version = Spotifier.Platform.version.split(".").map((i) => Number.parseInt(i, 10));
      if (version[1] >= 2 && version[2] < 31) return internalFetch;

      return async function (url, body) {
        const urlObj = new URL(url);

        const corsProxyURLTemplate = window.localStorage.getItem("spotifier:corsProxyTemplate") ?? "https://cors-proxy.spotifier.app/{url}";
        const isWebAPI = urlObj.hostname === "api.spotify.com";
        const isSpClientAPI = urlObj.hostname.includes("spotify.com") && urlObj.hostname.includes("spclient");
        const isInternalURL = internalEndpoints.has(urlObj.protocol);
        if (isInternalURL) return internalFetch.apply(this, [url, body]);

        const shouldUseCORSProxy = !isWebAPI && !isSpClientAPI && !isInternalURL;

        const method = allowedMethodsMap[prop.toLowerCase()];
        const headers = {
          "Content-Type": "application/json",
        };

        const options = {
          method,
          headers,
          timeout: 1000 * 15,
        };

        let finalURL = urlObj.toString();
        if (body) {
          if (method === "get") {
            const params = new URLSearchParams(body);
            const useSeparator = shouldUseCORSProxy && new URL(finalURL).search.startsWith("?");
            finalURL += `${useSeparator ? "&" : "?"}${params.toString()}`;
          } else options.body = !Array.isArray(body) && typeof body === "object" ? JSON.stringify(body) : body;
        }
        if (shouldUseCORSProxy) {
          finalURL = corsProxyURLTemplate.replace(/{url}/, finalURL);
          try {
            new URL(finalURL);
          } catch {
            console.error("[spotifierWrapper] Invalid CORS Proxy URL template");
          }
        }

        const Authorization = `Bearer ${Spotifier.Platform.AuthorizationAPI.getState().token.accessToken}`;
        let injectedHeaders = {};
        if (isWebAPI) injectedHeaders = { Authorization };
        if (isSpClientAPI) {
          injectedHeaders = {
            Authorization,
            "Spotify-App-Version": Spotifier.Platform.version,
            "App-Platform": Spotifier.Platform.PlatformData.app_platform,
          };
        }
        Object.assign(options.headers, injectedHeaders);

        try {
          return fetch(finalURL, options).then((res) => {
            if (!res.ok) return { code: res.status, error: res.statusText, message: "Failed to fetch", stack: undefined };
            try {
              return res.clone().json();
            } catch {
              try {
                return res.clone().blob();
              } catch {
                return res.clone().text();
              }
            }
          });
        } catch (e) {
          console.error(e);
        }
      };
    },
  };

  await waitFor(() => Spotifier.Player.origin, 50);
  Spotifier.Player.origin._cosmos = new Proxy(_cosmos, handler);
  Object.defineProperty(Spotifier, "CosmosAsync", {
    get: () => {
      return Spotifier.Player.origin?._cosmos;
    },
  });
})();
