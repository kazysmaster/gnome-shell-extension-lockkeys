import St from 'gi://St';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const STYLE = 'style';
const STYLE_NONE = 'none';
const STYLE_NUMLOCK_ONLY = 'numlock';
const STYLE_CAPSLOCK_ONLY = 'capslock';
const STYLE_BOTH = 'both';
const STYLE_SHOWHIDE = 'show-hide';
const STYLE_SHOWHIDE_CAPSLOCK = 'show-hide-capslock';
const NOTIFICATIONS = 'notification-preferences';
const NOTIFICATIONS_OFF = 'off';
const NOTIFICATIONS_ON = 'on';
const NOTIFICATIONS_OSD = 'osd';

export default class LockKeysExtension extends Extension {
    enable() {
        const config = new Configuration(this.getSettings());
        this._indicator = new LockKeysIndicator(config, this.dir);
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
    _init(config, extensionDir) {
        super._init(0.0, " LockKeysIndicator");
        this.config = config;
        this.extensionDir = extensionDir;
        this.iconTheme = new St.IconTheme();

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

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this.settingsMenuItem.connect('activate', this.handleSettingsMenuItem.bind(this));
        this.menu.addMenuItem(this.settingsMenuItem);

        this.indicatorStyle = new HighlightIndicator(this);
    }

	getCustIcon(icon_name) {
		if (this.iconTheme.has_icon(icon_name)) {
            return Gio.ThemedIcon.new_with_default_fallbacks(icon_name);
        }
		let icon_path = this.extensionDir.get_child('icons').get_child(icon_name + ".svg").get_path();
		return Gio.FileIcon.new(Gio.File.new_for_path(icon_path));
	}

	setActive(enabled) {
		if (enabled) {
			this._keyboardStateChangedId = this.keyMap.connect('state-changed', this.handleStateChange.bind(this));
			this._settingsChangedId = this.config.settings.connect('changed::' + STYLE, this.handleSettingsChange.bind(this));
			this._iconThemeChangedId = this.iconTheme.connect('changed', this.handleSettingsChange.bind(this));
			this.handleSettingsChange();
		} else {
			this.keyMap.disconnect(this._keyboardStateChangedId);
			this._keyboardStateChangedId = 0;
			this.config.settings.disconnect(this._settingsChangedId);
            this.iconTheme.disconnect(this._iconThemeChangedId);
			this._iconThemeChangedId = 0;
		}
	}

	handleSettingsMenuItem(actor, event) {
	    Main.extensionManager.openExtensionPrefs('lockkeys@vaina.lt', '', {});
	}

	handleSettingsChange(actor, event) {
		if (this.config.isVisibilityStyle())
			this.indicatorStyle = new VisibilityIndicator(this);
		else if (this.config.isVisibilityStyleCapslock())
			this.indicatorStyle = new VisibilityIndicatorCapslock(this);
		else
			this.indicatorStyle = new HighlightIndicator(this);
		this.updateState();
	}

	handleStateChange(actor, event) {
		if (this.numlock_state != this.getNumlockState() && this.config.isNotifyNumLock()) {
		    let notification_text = _("Num Lock") + ' ' + this.getStateText(this.getNumlockState());
            let icon_name = this.getNumlockState()? "numlock-enabled-symbolic" : "numlock-disabled-symbolic";
            this.showNotification(notification_text, icon_name);
		}

		if (this.capslock_state != this.getCapslockState() && this.config.isNotifyCapsLock()) {
			let notification_text = _("Caps Lock") + ' ' + this.getStateText(this.getCapslockState());
			let icon_name = this.getCapslockState()? "capslock-enabled-symbolic" : "capslock-disabled-symbolic";
            this.showNotification(notification_text, icon_name);
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

	showNotification(notification_text, icon_name) {
		if (this.config.isShowOsd()) {
			Main.osdWindowManager.show(-1, this.getCustIcon(icon_name), notification_text);
		} else {
			this.showSimpleNotification(notification_text, icon_name);
		}
	}

	showSimpleNotification(notification_text, icon_name) {
	    this.prepareSource(icon_name);

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

	prepareSource(icon_name) {
		if (this._source == null) {
			this._source = new MessageTray.Source("LockKeysIndicator", icon_name);

			let parent = this;
			this._source.createIcon = function(size) {
				return new St.Icon({
					gicon: parent.getCustIcon(parent._source.iconName),
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

const CustomIconSupplier = GObject.registerClass({
}, class CustomIconSupplier extends GObject.Object{
	_init(extensionDir) {
	    this.extensionDir = extensionDir;
	     this.iconTheme = new St.IconTheme();
	}

	getCustIcon(icon_name) {
        if (this.iconTheme.has_icon(icon_name)) {
            return Gio.ThemedIcon.new_with_default_fallbacks(icon_name);
        }
        let icon_path = this.extensionDir.get_child('icons').get_child(icon_name + ".svg").get_path();
        return Gio.FileIcon.new(Gio.File.new_for_path(icon_path));
    }
});

const HighlightIndicator = GObject.registerClass({
}, class HighlightIndicator extends GObject.Object{
	_init(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon;
		this.capsIcon = panelButton.capsIcon;

		if (this.config.isHighlightNumLock())
			this.numIcon.show();
		else
			this.numIcon.hide();

		if (this.config.isHighlightCapsLock())
			this.capsIcon.show();
		else
			this.capsIcon.hide();

		this.panelButton.visible = this.config.isHighlightNumLock() || this.config.isHighlightCapsLock();
	}

	displayState(numlock_state, capslock_state) {
		if (numlock_state)
			this.numIcon.set_gicon(this.panelButton.getCustIcon('numlock-enabled-symbolic'));
		else
			this.numIcon.set_gicon(this.panelButton.getCustIcon('numlock-disabled-symbolic'));

		if (capslock_state)
			this.capsIcon.set_gicon(this.panelButton.getCustIcon('capslock-enabled-symbolic'));
		else
			this.capsIcon.set_gicon(this.panelButton.getCustIcon('capslock-disabled-symbolic'));
	}
});

const VisibilityIndicator = GObject.registerClass({
}, class VisibilityIndicator extends GObject.Object{
	_init(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon;
		this.capsIcon = panelButton.capsIcon;

		this.numIcon.set_gicon(this.panelButton.getCustIcon('numlock-enabled-symbolic'));
		this.capsIcon.set_gicon(this.panelButton.getCustIcon('capslock-enabled-symbolic'));
	}

	displayState(numlock_state, capslock_state) {
		if (numlock_state) {
			this.numIcon.show();
		} else
			this.numIcon.hide();

		if (capslock_state) {
			this.capsIcon.show();
		} else
			this.capsIcon.hide();

		this.panelButton.visible = numlock_state || capslock_state;
	}
});

const VisibilityIndicatorCapslock = GObject.registerClass({
}, class VisibilityIndicatorCapslock extends GObject.Object{
	_init(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.capsIcon = panelButton.capsIcon;

		panelButton.numIcon.hide();
		this.capsIcon.set_gicon(this.panelButton.getCustIcon('capslock-enabled-symbolic'));
	}

	displayState(numlock_state, capslock_state) {
		if (capslock_state) {
			this.capsIcon.show();
		} else
			this.capsIcon.hide();

		this.panelButton.visible = capslock_state;
	}
});

const Configuration = GObject.registerClass({
}, class Configuration extends GObject.Object{
	_init(settings) {
		this.settings = settings;
	}

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
		return this.isShowNotifications() && widget_style != STYLE_CAPSLOCK_ONLY;
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
});
