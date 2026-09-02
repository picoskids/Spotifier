import { createIconComponent } from "./icons.js";

let navLinkFactoryCtx = null;
export let refreshNavLinks = null;

const manifestCache = new Map();

function getManifest(app) {
  if (manifestCache.has(app)) return manifestCache.get(app);

  manifestCache.set(app, {});
  fetch(`spotifier-routes-${app}.json`)
    .then((res) => res.json())
    .then((manifest) => {
      manifestCache.set(app, manifest);
      refreshNavLinks?.();
    })
    .catch(() => {
      // Keep the {} placeholder already cached
    });

  return {};
}

Spotifier._renderNavLinks = (list, isTouchScreenUi) => {
  const [, refresh] = Spotifier.React.useReducer((x) => x + 1, 0);
  refreshNavLinks = refresh;

  if (
    !Spotifier.ReactComponent.ButtonTertiary ||
    !Spotifier.ReactComponent.Navigation ||
    !Spotifier.ReactComponent.TooltipWrapper ||
    !Spotifier.ReactComponent.ScrollableContainer ||
    !Spotifier.Platform.History ||
    !Spotifier.Platform.LocalStorageAPI
  )
    return;

  const navLinkFactory = isTouchScreenUi ? NavLinkGlobal : NavLinkSidebar;

  if (!navLinkFactoryCtx) navLinkFactoryCtx = Spotifier.React.createContext(null);
  const registered = [];

  for (const app of list) {
    const manifest = getManifest(app);

    let appProper = manifest.name;
    if (typeof appProper === "object") {
      appProper = appProper[Spotifier.Locale?.getLocale()] || appProper.en;
    }
    if (!appProper) {
      appProper = app[0].toUpperCase() + app.slice(1);
    }
    const icon = manifest.icon || "";
    const activeIcon = manifest["active-icon"] || icon;
    const appRoutePath = `/${app}`;
    registered.push({ appProper, appRoutePath, icon, activeIcon });
  }

  (function addStyling() {
    if (document.querySelector("style.spotifier-navlinks")) return;
    const style = document.createElement("style");
    style.className = "spotifier-navlinks";
    style.innerHTML = `
	:root {
		--max-custom-navlink-count: 4;
	}

	.custom-navlinks-scrollable_container {
		max-width: calc(48px * var(--max-custom-navlink-count) + 8px * (var(--max-custom-navlink-count) - 1));
		-webkit-app-region: no-drag;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] > *:not(:last-child) {
		margin-inline-end: 8px;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] {
		display: flex;
		flex-direction: row;
	}

	.custom-navlink {
		-webkit-app-region: unset;
	}
		`;
    document.head.appendChild(style);
  })();

  const wrapScrollableContainer = (element) =>
    Spotifier.React.createElement(
      "div",
      { className: "custom-navlinks-scrollable_container" },
      Spotifier.React.createElement(Spotifier.ReactComponent.ScrollableContainer, null, element),
    );

  const NavLinks = () =>
    Spotifier.React.createElement(
      navLinkFactoryCtx.Provider,
      { value: navLinkFactory },
      registered.map((NavLinkElement) => Spotifier.React.createElement(NavLink, NavLinkElement, null)),
    );

  return isTouchScreenUi ? wrapScrollableContainer(NavLinks()) : NavLinks();
};

const NavLink = ({ appProper, appRoutePath, icon, activeIcon }) => {
  const isActive = Spotifier.Platform.History.location.pathname?.startsWith(appRoutePath);
  const createIcon = () => createIconComponent(isActive ? activeIcon : icon, 24);

  const NavLinkFactory = Spotifier.React.useContext(navLinkFactoryCtx);

  return NavLinkFactory && Spotifier.React.createElement(NavLinkFactory, { appProper, appRoutePath, createIcon, isActive }, null);
};

const NavLinkSidebar = ({ appProper, appRoutePath, createIcon, isActive }) => {
  const isSidebarCollapsed = Spotifier.Platform.LocalStorageAPI.getItem("ylx-sidebar-state") === 1;

  return Spotifier.React.createElement(
    "li",
    { className: "main-yourLibraryX-navItem InvalidDropTarget" },
    Spotifier.React.createElement(
      Spotifier.ReactComponent.TooltipWrapper,
      { label: isSidebarCollapsed ? appProper : null, disabled: !isSidebarCollapsed, placement: "right" },
      Spotifier.React.createElement(
        Spotifier.ReactComponent.Navigation,
        {
          to: appRoutePath,
          referrer: "other",
          className: Spotifier.classnames("link-subtle", "main-yourLibraryX-navLink", {
            "main-yourLibraryX-navLinkActive": isActive,
          }),
          onClick: () => undefined,
          "aria-label": appProper,
        },
        createIcon(),
        !isSidebarCollapsed && Spotifier.React.createElement(Spotifier.ReactComponent.TextComponent, { variant: "balladBold" }, appProper),
      ),
    ),
  );
};

const NavLinkGlobal = ({ appProper, appRoutePath, createIcon, isActive }) => {
  return Spotifier.React.createElement(
    Spotifier.ReactComponent.TooltipWrapper,
    { label: appProper },
    Spotifier.React.createElement(Spotifier.ReactComponent.ButtonTertiary, {
      iconOnly: createIcon,
      className: Spotifier.classnames("link-subtle", "main-globalNav-navLink", "main-globalNav-link-icon", "custom-navlink", {
        "main-globalNav-navLinkActive": isActive,
      }),
      "aria-label": appProper,
      onClick: () => Spotifier.Platform.History.push(appRoutePath),
    }),
  );
};
