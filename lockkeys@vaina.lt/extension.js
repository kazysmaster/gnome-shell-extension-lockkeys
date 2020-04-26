const St = imports.gi.St;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext.domain('lockkeys');
const _ = Gettext.gettext;

const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Config = imports.misc.config;

const POST_3_36 = parseFloat(Config.PACKAGE_VERSION) >= 3.36;
const POST_3_34 = parseFloat(Config.PACKAGE_VERSION) >= 3.34;
const Keymap = POST_3_36 ? Clutter.get_default_backend().get_default_seat().get_keymap():
			   POST_3_34 ? Clutter.get_default_backend().get_keymap():
			   imports.gi.Gdk.Keymap.get_default();


const ExtensionUtils = imports.misc.extensionUtils;
const Meta = ExtensionUtils.getCurrentExtension();
const Utils = Meta.imports.utils;


const STYLE = 'style';
const STYLE_NUMLOCK = 'numlock';
const STYLE_CAPSLOCK = 'capslock';
const STYLE_BOTH = 'both';
const STYLE_SHOWHIDE = 'show-hide';
const NOTIFICATIONS = 'notification-preferences';
const NOTIFICATIONS_OFF = 'off';
const NOTIFICATIONS_ON = 'on';
const NOTIFICATIONS_OSD = 'osd';

let indicator;

function main() {
	init();
	enable();
}

function init() {
	Utils.initTranslations("lockkeys");
}

function enable() {
	indicator = new LockKeysIndicator();	
	Main.panel.addToStatusArea('lockkeys', indicator, 2);
	indicator.setActive(true);
}

function disable() {
	indicator.setActive(false);
	indicator.destroy();
}

const LockKeysIndicator = new Lang.Class({
	Name: 'LockKeysIndicator',
	Extends: PanelMenu.Button,

	_getCustIcon: function(icon_name) {
		//workaround for themed icon
		//new Gio.ThemedIcon({ name: icon_name });
		//return Gio.ThemedIcon.new_with_default_fallbacks(icon_name);
		let icon_path = Meta.dir.get_child('icons').get_child(icon_name + ".svg").get_path();
		let theme = Gtk.IconTheme.get_default();
		if (theme) {
			let theme_icon = theme.lookup_icon(icon_name, -1, 2);
			if (theme_icon) {
				icon_path = theme_icon.get_filename();
			}
		}
		return Gio.FileIcon.new(Gio.File.new_for_path(icon_path));
	},

	_init: function() {
		this.parent(0.0, "LockKeysIndicator");

		this.numIcon = new St.Icon({
			style_class: 'system-status-icon'
		});
		this.capsIcon = new St.Icon({
			style_class: 'system-status-icon'
		});

		let layoutManager = new St.BoxLayout({
			vertical: false,
			style_class: 'lockkeys-container'
		});
		layoutManager.add_child(this.numIcon);
		layoutManager.add_child(this.capsIcon);
		this.add_child_compat(layoutManager);
		
		this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Num Lock"), false, { reactive: false });
		this.menu.addMenuItem(this.numMenuItem);

		this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Caps Lock"), false, { reactive: false });
		this.menu.addMenuItem(this.capsMenuItem);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
		this.settingsMenuItem.connect('activate', Lang.bind(this, this._handleSettingsMenuItem));
		this.menu.addMenuItem(this.settingsMenuItem);
		
		this.config = new Configuration();
		this.indicatorStyle = new HighlightIndicator(this);
	},

	add_child_compat: function(child) {
		if (POST_3_34)
			this.add_child(child);
		else
			this.actor.add_child(child);
	},

	setActive: function(enabled) {
		if (enabled) {
			this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._handleStateChange));
			this._settingsChangeId = this.config.settings.connect('changed::' + STYLE, Lang.bind(this, this._handleSettingsChange));
			this._handleSettingsChange();
		} else {
			Keymap.disconnect(this._keyboardStateChangedId);
			this.config.settings.disconnect(this._settingsChangeId);
		}
	}, 

	_handleSettingsMenuItem: function(actor, event) {
		if (POST_3_36)
			imports.misc.util.spawn(['gnome-extensions', 'prefs', 'lockkeys@vaina.lt']);
		else
			imports.misc.util.spawn(['gnome-shell-extension-prefs', 'lockkeys@vaina.lt']);
	},
	
	_handleSettingsChange: function(actor, event) {
		if (this.config.isShowHideStyle())
			this.indicatorStyle = new ShowhideIndicator(this);
		else
			this.indicatorStyle = new HighlightIndicator(this);
		this._updateState(actor);
	},

	_handleStateChange: function(actor, event) {
		if (this.numlock_state != this._getNumlockState()) {
			let notification_text = _("Num Lock") + ' ' + this._getStateText(this._getNumlockState());
			if (this.config.isShowNotifications() && this.config.isShowNumLock()) {
				let icon_name = this._getNumlockState()? "numlock-enabled-symbolic" : "numlock-disabled-symbolic";
				this._showNotification(notification_text, icon_name);				
			}
		}
		if (this.capslock_state != this._getCapslockState()) {
			let notification_text = _("Caps Lock") + ' ' + this._getStateText(this._getCapslockState());
			if (this.config.isShowNotifications() && this.config.isShowCapsLock()) {
				let icon_name = this._getCapslockState()? "capslock-enabled-symbolic" : "capslock-disabled-symbolic";
				this._showNotification(notification_text, icon_name);
			}
		}
		this._updateState();
	},

	_updateState: function() {
		this.numlock_state = this._getNumlockState();
		this.capslock_state = this._getCapslockState();

		this.indicatorStyle.displayState(this.numlock_state, this.capslock_state);
		this.numMenuItem.setToggleState(this.numlock_state);
		this.capsMenuItem.setToggleState(this.capslock_state);
	},

	_showNotification: function(notification_text, icon_name) {
		if (this.config.isShowOsd()) {
			Main.osdWindowManager.show(-1, this._getCustIcon(icon_name), notification_text);
		} else {
			this._prepareSource(icon_name);

			let notification = null;
			if (this._source.notifications.length == 0) {
				notification = new MessageTray.Notification(this._source, notification_text);
				notification.setTransient(true);
				notification.setResident(false);
			} else {
				notification = this._source.notifications[0];
				notification.update(notification_text, null, { clear: true });
			}

			this._source.notify(notification);
		}
	},

	_prepareSource: function(icon_name) {
		if (this._source == null) {
			this._source = new MessageTray.Source("LockKeysIndicator", icon_name);
			
			let parent = this;
			this._source.createIcon = function(size) {
				return new St.Icon({ 
					gicon: parent._getCustIcon(parent._source.iconName),
                     			icon_size: size 
                 		});
			}
			
			this._source.connect('destroy', Lang.bind(this, function() {
				this._source = null;
			}));
			Main.messageTray.add(this._source);
		}
		this._source.iconName = icon_name;
	},

	_getStateText: function(state) {
		return state ? _("On") : _("Off");
	},

	_getNumlockState: function() {
		return Keymap.get_num_lock_state();
	},

	_getCapslockState: function() {
		return Keymap.get_caps_lock_state();
	}
});

function HighlightIndicator(panelButton) {
	this._init(panelButton);
}

HighlightIndicator.prototype = {
	_init: function(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon; 
		this.capsIcon = panelButton.capsIcon;
		
		if (this.config.isShowNumLock())
			this.numIcon.show();
		else
			this.numIcon.hide();
		
		if (this.config.isShowCapsLock())
			this.capsIcon.show();
		else
			this.capsIcon.hide();
	},
	
	displayState: function(numlock_state, capslock_state) {
		
		if (numlock_state)
			this.numIcon.set_gicon(this.panelButton._getCustIcon('numlock-enabled-symbolic'));
		else
			this.numIcon.set_gicon(this.panelButton._getCustIcon('numlock-disabled-symbolic'));
		
		if (capslock_state)
			this.capsIcon.set_gicon(this.panelButton._getCustIcon('capslock-enabled-symbolic'));
		else
			this.capsIcon.set_gicon(this.panelButton._getCustIcon('capslock-disabled-symbolic'));
	}
}

function ShowhideIndicator(panelButton) {
	this._init(panelButton);
}

ShowhideIndicator.prototype = {
	_init: function(panelButton) {
		this.panelButton = panelButton;
		this.config = panelButton.config;
		this.numIcon = panelButton.numIcon; 
		this.capsIcon = panelButton.capsIcon;
	},
	
	displayState: function(numlock_state, capslock_state) {
		if (numlock_state) {
			this.numIcon.set_gicon(this.panelButton._getCustIcon('numlock-enabled-symbolic'));
			this.numIcon.show();
		} else
			this.numIcon.hide();

		if (capslock_state) {
			this.capsIcon.set_gicon(this.panelButton._getCustIcon('capslock-enabled-symbolic'));
			this.capsIcon.show();
		} else
			this.capsIcon.hide();
			
		this.panelButton.visible = numlock_state || capslock_state;
	}
}

function Configuration() {
	this._init();
}

Configuration.prototype = {
	_init: function() {
		this.settings = Utils.getSettings(Meta);
	},
	
	isShowNotifications: function() {
		let notification_prefs = this.settings.get_string(NOTIFICATIONS);
		return notification_prefs == NOTIFICATIONS_ON || notification_prefs == NOTIFICATIONS_OSD;
	},
	
	isShowOsd: function() {
		let notification_prefs = this.settings.get_string(NOTIFICATIONS);
		return notification_prefs == NOTIFICATIONS_OSD;
	},
	
	isShowNumLock: function() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_NUMLOCK || widget_style == STYLE_BOTH || widget_style == STYLE_SHOWHIDE; 
	},
	
	isShowCapsLock: function() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_CAPSLOCK || widget_style == STYLE_BOTH || widget_style == STYLE_SHOWHIDE; 
	},
	
	isShowHideStyle: function() {
		let widget_style = this.settings.get_string(STYLE);
		return widget_style == STYLE_SHOWHIDE;
	}
}