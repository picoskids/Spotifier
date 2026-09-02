import "./core.js";
import "./events.js";
import "./platform.js";
import "./icons.js";
import "./menus.js";
import "./custom-apps.js";
import "./webpack.js";
import "./player-events.js";
import "./helpers.js";
import "./popup.js";
import "./topbar.js";
import "./playbar.js";
import "./update.js";

// Alias for third-party themes/extensions written against the real
// spicetify's window.Spicetify global (e.g. spicetify-marketplace),
// which we don't control and can't rename.
window.Spicetify = window.Spotifier;
