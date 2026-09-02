import { refreshNavLinks } from "./custom-apps.js";
import { waitFor } from "./shared/async.js";
import { exposeReactComponentsUI } from "./webpack/component-resolvers.js";
import { waitForLateComponents } from "./webpack/late-components.js";
import { getModuleInventory, groupBy } from "./webpack/module-inventory.js";
import { exposeRuntimeResolvers } from "./webpack/runtime-resolvers.js";
import { createScrollableContainer } from "./webpack/scrollable-container.js";
import { createSpotifierBindings } from "./webpack/spotifier-bindings.js";
import { waitForURI } from "./webpack/uri.js";

void (async function hotloadWebpackModules() {
  const getChunkQueue = () => window?.webpackChunkclient_web || window?.rspackChunkclient_web;
  const chunkQueue = await waitFor(getChunkQueue, 50);

  // Force all webpack modules to load
  const require = chunkQueue.push([[Symbol()], {}, (re) => re]);
  await waitFor(() => require.m, 50);
  console.log("[spotifierWrapper] Waiting for required webpack modules to load");
  let webpackDidCallback = false;
  // https://github.com/webpack/webpack/blob/main/lib/runtime/OnChunksLoadedRuntimeModule.js
  require.O(
    null,
    [],
    () => {
      webpackDidCallback = true;
    },
    1,
  );

  let inventory = getModuleInventory(require);
  let chunks = inventory.chunks;
  let cache = inventory.cache;

  // For _renderNavLinks to work
  Spotifier.React = cache.find((m) => m?.useMemo);

  await waitFor(() => webpackDidCallback, 100);
  console.log("[spotifierWrapper] All required webpack modules loaded");
  inventory = getModuleInventory(require);
  chunks = inventory.chunks;
  cache = inventory.cache;
  Spotifier.Events.platformLoaded.fire();

  const { modules, functionModules } = inventory;
  const exportedReactObjects = groupBy(modules.filter(Boolean), (x) => x.$$typeof);
  const exportedMemos = exportedReactObjects[Symbol.for("react.memo")] ?? [];
  const exportedForwardRefs = exportedReactObjects[Symbol.for("react.forward_ref")] ?? [];
  const exportedMemoFRefs = exportedMemos.filter((m) => m.type.$$typeof === Symbol.for("react.forward_ref"));
  const reactComponentsUI = exposeReactComponentsUI({ modules, functionModules, exportedForwardRefs, exportedMemoFRefs });

  Object.assign(
    Spotifier,
    createSpotifierBindings({
      cache,
      chunks,
      modules,
      functionModules,
      require,
      exportedMemos,
      exportedMemoFRefs,
      reactComponentsUI,
      scrollableContainer: createScrollableContainer(),
    }),
  );

  if (!Spotifier.ContextMenuV2._context) Spotifier.ContextMenuV2._context = Spotifier.React.createContext({});

  waitForLateComponents({ require, refreshNavLinks });

  exposeRuntimeResolvers({ cache, chunks, modules, functionModules, require });

  waitForURI({ cache, modules, functionModules });

  Spotifier.Events.webpackLoaded.fire();
  refreshNavLinks?.();
})();
