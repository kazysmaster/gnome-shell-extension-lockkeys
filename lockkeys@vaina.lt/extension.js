import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const POST_46 = parseFloat(Config.PACKAGE_VERSION) >= 46;
const POST_49 = parseFloat(Config.PACKAGE_VERSION) >= 49;

const STYLE = 'style';
const STYLE_NONE = 'none';
const STYLE_NUMLOCK_ONLY = 'numlock';
const STYLE_CAPSLOCK_ONLY = 'capslock';
const STYLE_BOTH = 'both';
const STYLE_SHOWHIDE = 'show-hide';
const STYLE_SHOWHIDE_CAPSLOCK = 'show-hide-capslock';
const NOTIFICATIONS = 'notification-preferences';
//const NOTIFICATIONS_OFF = 'off';
const NOTIFICATIONS_ON = 'on';
//const NOTIFICATIONS_OSD = 'osd';

const NOTIFICATION_OFF = "off";
const NOTIFICATION_COMPACT = "compact";
const NOTIFICATION_OSD = "osd";
const VISIBILITY_NEVER = "never";
const VISIBILITY_WHEN_ACTIVE = "when-active";
const VISIBILITY_ALWAYS = "always";

export default class LockKeysExtension extends Extension {
    enable() {
        const config = new Configuration(this.getSettings());
        const icons = new ExtensionIcons(this.dir);
        this._indicator = new LockKeysIndicator(config, icons);
        Main.panel.addToStatusArea('lockkeys', this._indicator, 2);
        this._indicator.setActive(true);
    }

    disable() {
        this._indicator.setActive(false);
        this._indicator.destroy();
        this._indicator = null;
    }
}

const LockKeysIndicator = GObject.registerClass({
}, class LockKeysIndicator extends PanelMenu.Button {
    _init(config, icons) {
        super._init(0.0, " LockKeysIndicator");
        this.config = config;
        this.icons = icons;
        this.keyMap = Clutter.get_default_backend().get_default_seat().get_keymap();

        this.numIcon = new St.Icon({
            style_class: 'system-status-icon lockkeys-status-icon'
        });
        this.capsIcon = new St.Icon({
            style_class: 'system-status-icon lockkeys-status-icon'
        });

        this.numIcon.set_style('padding-right: 0px; padding-left: 0px;');
        this.capsIcon.set_style('padding-right: 0px; padding-left: 0px;');

        let layoutManager = new St.BoxLayout({
            vertical: false,
            style_class: 'lockkeys-container'
        });
        layoutManager.add_child(this.numIcon);
        layoutManager.add_child(this.capsIcon);
        this.add_child(layoutManager);

        this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Num Lock"), false, { reactive: false });
        this.menu.addMenuItem(this.numMenuItem);

        this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Caps Lock"), false, { reactive: false });
        this.menu.addMenuItem(this.capsMenuItem);

        this.a11ySettings = new Gio.Settings({
            schema: 'org.gnome.desktop.a11y.interface'
        });

        this.updateSwitchOpacity();
        this._highContrastChangedId = this.a11ySettings.connect('changed::high-contrast', () => {
            this.updateSwitchOpacity();
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this.menu.addMenuItem(this.settingsMenuItem);
        this.settingsMenuItem.connect('activate', function(menu_item) {
            Main.extensionManager.openExtensionPrefs('lockkeys@vaina.lt', '', {});
        });

        this.indicatorStyle = new HighlightIndicatorStyle(this);
		this.updateState();
    }

    updateSwitchOpacity() {
        const isHighContrast = this.a11ySettings.get_boolean('high-contrast');
        const disabledOpacity = isHighContrast ? 0.4 : 0.5;
        
        this.numMenuItem._switch.set_opacity(disabledOpacity * 255);
        this.capsMenuItem._switch.set_opacity(disabledOpacity * 255);
    }

	setActive(enabled) {
		if (enabled) {
			this._keyboardStateChangedId = this.keyMap.connect('state-changed', this.handleStateChange.bind(this));
           	this._settingsChangedId = this.config.settings.connect('changed', this.handleSettingsChange.bind(this));
           	this._iconThemeChangedId = this.icons.iconTheme.connect('changed', this.handleSettingsChange.bind(this));
           	this.handleSettingsChange();
		} else {
			this.keyMap.disconnect(this._keyboardStateChangedId);
			this._keyboardStateChangedId = 0;
			this.config.settings.disconnect(this._settingsChangedId);
			this._settingsChangedId = 0;
            this.icons.iconTheme.disconnect(this._iconThemeChangedId);
			this._iconThemeChangedId = 0;
            if (this._highContrastChangedId) {
                this.a11ySettings.disconnect(this._highContrastChangedId);
                this._highContrastChangedId = 0;
            }
		}
	}

	handleSettingsChange(actor, event) {
        const numSetting = this.config.getNumlockIndicator();
        const capsSetting = this.config.getCapslockIndicator();

        if (numSetting === VISIBILITY_NEVER && capsSetting === VISIBILITY_WHEN_ACTIVE) {
            this.indicatorStyle = new VisibilityIndicatorCapslockStyle(this);
        } else if (numSetting === VISIBILITY_WHEN_ACTIVE && capsSetting === VISIBILITY_WHEN_ACTIVE) {
            this.indicatorStyle = new VisibilityIndicatorStyle(this);
        } else {
            this.indicatorStyle = new HighlightIndicatorStyle(this);
        }
        this.updateState();
	}

	handleStateChange(actor, event) {
		if (this.numlock_state != this.getNumlockState() && this.config.getNumlockNotification() !== NOTIFICATION_OFF) {
		    let notification_text = _("Num Lock") + ' ' + this.getStateText(this.getNumlockState());
            let icon_name = this.getNumlockState()? "numlock-enabled-symbolic" : "numlock-disabled-symbolic";
            this.showNumlockNotification(notification_text, icon_name);
		}

		if (this.capslock_state != this.getCapslockState() && this.config.getCapslockNotification() !== NOTIFICATION_OFF) {
			let notification_text = _("Caps Lock") + ' ' + this.getStateText(this.getCapslockState());
			let icon_name = this.getCapslockState()? "capslock-enabled-symbolic" : "capslock-disabled-symbolic";
            this.showCapslockNotification(notification_text, icon_name);
		}

		this.updateState();
	}

	updateState() {
		this.numlock_state = this.getNumlockState();
		this.capslock_state = this.getCapslockState();

		this.indicatorStyle.displayState(this.numlock_state, this.capslock_state);
		this.numMenuItem.setToggleState(this.numlock_state);
		this.capsMenuItem.setToggleState(this.capslock_state);
	}

	showNumlockNotification(notification_text, icon_name) {
		if (this.config.getNumlockNotification() === NOTIFICATION_OSD) {
			if (POST_49) {
				Main.osdWindowManager.showAll(this.icons.getCustomIcon(icon_name), notification_text);
			} else {
				Main.osdWindowManager.show(-1, this.icons.getCustomIcon(icon_name), notification_text);
			}
		} else if (this.config.getNumlockNotification() === NOTIFICATION_COMPACT) {
			if (POST_46) {
				this.showSimpleNotification(notification_text, icon_name, '_numlockSource');
			} else {
				this.showSimpleNotification45(notification_text, icon_name, '_numlockSource');
			}
		}
	}

	showCapslockNotification(notification_text, icon_name) {
		if (this.config.getCapslockNotification() === NOTIFICATION_OSD) {
			if (POST_49) {
				Main.osdWindowManager.showAll(this.icons.getCustomIcon(icon_name), notification_text);
			} else {
				Main.osdWindowManager.show(-1, this.icons.getCustomIcon(icon_name), notification_text);
			}
		} else if (this.config.getCapslockNotification() === NOTIFICATION_COMPACT) {
			if (POST_46) {
				this.showSimpleNotification(notification_text, icon_name, '_capslockSource');
			} else {
				this.showSimpleNotification45(notification_text, icon_name, '_capslockSource');
			}
		}
	}

	showSimpleNotification(notification_text, icon_name) {
        this.prepareSource(icon_name);

        let notification = null;
        if (this._source.notifications.length == 0) {
            notification = new MessageTray.Notification({
                source: this._source,
                title: notification_text
            });
            notification['is-transient'] = true;
            notification['resident'] = false;
        } else {
            notification = this._source.notifications[0];
            notification.title = notification_text
        }

        this._source.addNotification(notification);
    }

    prepareSource(icon_name) {
        if (this._source == null) {
            this._source = new MessageTray.Source({
                title: "Lock Keys"
            });

            const parent = this;
            this._source.connect('destroy', function() {
                parent._source = null;
            });
            Main.messageTray.add(this._source);
        }
        this._source.icon = this.icons.getCustomIcon(icon_name);
    }

	showSimpleNotification45(notification_text, icon_name) {
	    this.prepareSource45(icon_name);

        let notification = null;
        if (this._source.notifications.length == 0) {
            notification = new MessageTray.Notification(this._source, notification_text);
            notification.setTransient(true);
            notification.setResident(false);
        } else {
            notification = this._source.notifications[0];
            notification.update(notification_text, null, { clear: true });
        }

	    this._source.showNotification(notification);
	}

	prepareSource45(icon_name) {
		if (this._source == null) {
			this._source = new MessageTray.Source("Lock Keys", icon_name);

			let parent = this;
			this._source.createIcon = function(size) {
				return new St.Icon({
					gicon: parent.icons.getCustomIcon(parent._source.iconName),
                    icon_size: size
                });
			}

			this._source.connect('destroy', function() {
				parent._source = null;
			});
			Main.messageTray.add(this._source);
		}
		this._source.iconName = icon_name;
	}

	getStateText(state) {
		return state ? _("On") : _("Off");
	}

	getNumlockState() {
        return this.keyMap.get_num_lock_state();
	}

	getCapslockState() {
        return this.keyMap.get_caps_lock_state();
	}
});

const ExtensionIcons = GObject.registerClass({
}, class ExtensionIcons extends GObject.Object{
	_init(extensionDir) {
	    this._extensionDir = extensionDir;
	    this.iconTheme = new St.IconTheme();
	}

	getCustomIcon(icon_name) {
        if (this.iconTheme.has_icon(icon_name)) {
            return Gio.ThemedIcon.new_with_default_fallbacks(icon_name);
        }
        let icon_path = this._extensionDir.get_child('icons').get_child(icon_name + ".svg").get_path();
        return Gio.FileIcon.new(Gio.File.new_for_path(icon_path));
    }
});

const HighlightIndicatorStyle = GObject.registerClass({
}, class HighlightIndicatorStyle extends GObject.Object{
	_init(indicator) {
		this._indicator = indicator;
		this._config = indicator.config;
		this._icons = indicator.icons;
		this._numIcon = indicator.numIcon;
		this._capsIcon = indicator.capsIcon;

        this.displayState(this._indicator.getNumlockState(), this._indicator.getCapslockState());
    }

	displayState(numlock_state, capslock_state) {
        if (this._config.getNumlockIndicator() == VISIBILITY_NEVER) {
            this._numIcon.hide();
        } else if (this._config.getNumlockIndicator() == VISIBILITY_WHEN_ACTIVE) {
            if (numlock_state) {
                this._numIcon.show();
                this._numIcon.set_gicon(this._icons.getCustomIcon('numlock-enabled-symbolic'));
            } else {
                this._numIcon.hide();
            }
        } else if (this._config.getNumlockIndicator() == VISIBILITY_ALWAYS) {
            this._numIcon.show();
            this._numIcon.set_gicon(this._icons.getCustomIcon(
                numlock_state ? 'numlock-enabled-symbolic' : 'numlock-disabled-symbolic'
            ));
        }

        // Handle Capslock visibility
        if (this._config.getCapslockIndicator() == VISIBILITY_NEVER) {
            this._capsIcon.hide();
        } else if (this._config.getCapslockIndicator() == VISIBILITY_WHEN_ACTIVE) {
            if (capslock_state) {
                this._capsIcon.show();
                this._capsIcon.set_gicon(this._icons.getCustomIcon('capslock-enabled-symbolic'));
            } else {
                this._capsIcon.hide();
            }
        } else if (this._config.getCapslockIndicator() == VISIBILITY_ALWAYS) {
            this._capsIcon.show();
            this._capsIcon.set_gicon(this._icons.getCustomIcon(
                capslock_state ? 'capslock-enabled-symbolic' : 'capslock-disabled-symbolic'
            ));
        }

        // Update overall indicator visibility
        this._indicator.visible = 
            (this._numIcon.visible || this._capsIcon.visible);
	}
});

const VisibilityIndicatorStyle = GObject.registerClass({
}, class VisibilityIndicatorStyle extends GObject.Object{
	_init(indicator) {
        this._indicator = indicator;
        this._config = indicator.config;
        this._icons = indicator.icons;
        this._numIcon = indicator.numIcon;
        this._capsIcon = indicator.capsIcon;

		this._numIcon.set_gicon(this._icons.getCustomIcon('numlock-enabled-symbolic'));
		this._capsIcon.set_gicon(this._icons.getCustomIcon('capslock-enabled-symbolic'));
	}

	displayState(numlock_state, capslock_state) {
		if (numlock_state) {
			this._numIcon.show();
		} else
			this._numIcon.hide();

		if (capslock_state) {
			this._capsIcon.show();
		} else
			this._capsIcon.hide();

		this._indicator.visible = numlock_state || capslock_state;
	}
});

const VisibilityIndicatorCapslockStyle = GObject.registerClass({
}, class VisibilityIndicatorCapslockStyle extends GObject.Object{
	_init(indicator) {
        this._indicator = indicator;
        this._config = indicator.config;
        this._icons = indicator.icons;
        this._capsIcon = indicator.capsIcon;

		indicator.numIcon.hide();
		this._capsIcon.set_gicon(this._icons.getCustomIcon('capslock-enabled-symbolic'));
	}

	displayState(numlock_state, capslock_state) {
		if (capslock_state) {
			this._capsIcon.show();
		} else {
			this._capsIcon.hide();
        }
		this._indicator.visible = capslock_state;
	}
});

const Configuration = GObject.registerClass({
}, class Configuration extends GObject.Object{
	_init(settings) {
		this.settings = settings;
	}

	// Old configuration functions
	isShowNotifications() {
		let notification_prefs = this.settings.get_string(NOTIFICATIONS);
		return notification_prefs == NOTIFICATIONS_ON || notification_prefs == NOTIFICATIONS_OSD;
	}

	isShowOsd() {
		let notification_prefs = this.settings.get_string(NOTIFICATIONS);
		return notification_prefs == NOTIFICATIONS_OSD;
	}

	isNotifyNumLock() {
        let widget_style = this.settings.get_string(STYLE);
        return this.isShowNotifications() &&
            widget_style != STYLE_CAPSLOCK_ONLY &&
            widget_style != STYLE_SHOWHIDE_CAPSLOCK;
    }

	isNotifyCapsLock() {
		let widget_style = this.settings.get_string(STYLE);
		return this.isShowNotifications() && widget_style != STYLE_NUMLOCK_ONLY;
	}

	isHighlightNumLock() {
        let widget_style = this.settings.get_string(STYLE);
        return widget_style == STYLE_BOTH || widget_style == STYLE_NUMLOCK_ONLY;
    }

    isHighlightCapsLock() {
        let widget_style = this.settings.get_string(STYLE);
        return widget_style == STYLE_BOTH || widget_style == STYLE_CAPSLOCK_ONLY;
    }

	isVisibilityStyle() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_SHOWHIDE;
	}

	isVisibilityStyleCapslock() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_SHOWHIDE_CAPSLOCK;
	}

	// New configuration functions
	isCapslockEnabled() {
		return this.settings.get_boolean('capslock-enabled');
	}

	getCapslockNotification() {
		return this.settings.get_string('capslock-notification');
	}

	getCapslockIndicator() {
		return this.settings.get_string('capslock-indicator');
	}

	isNumlockEnabled() {
		return this.settings.get_boolean('numlock-enabled');
	}

	getNumlockNotification() {
		return this.settings.get_string('numlock-notification');
	}

	getNumlockIndicator() {
		return this.settings.get_string('numlock-indicator');
	}
});
