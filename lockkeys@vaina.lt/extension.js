const St = imports.gi.St;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

const Keymap = Gdk.Keymap.get_default();
const Caribou = imports.gi.Caribou;

const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

const Meta = imports.misc.extensionUtils.getCurrentExtension();

//Preferences support
const EXTENSION_PREFS = '{ "notifications": true }';

const CONFIG_DIR = "/gnome-shell-lockkeys";
const CONFIG_FILE = "/gnome-shell-lockkeys/prefs.json";


let indicator;

function main() {
	init();
	enable();
}

function init() {
}

function enable() {
	indicator = new LockKeysIndicator();
	indicator.setActive(true);
	Main.panel._rightBox.insert_child_at_index(indicator.actor,  getPreferredIndex());
	Main.panel._menus.addMenu(indicator.menu);
}

function disable() {
	Main.panel._rightBox.remove_actor(indicator.actor);
	Main.panel._menus.removeMenu(indicator.menu);
	indicator.setActive(false);
	//indicator.destroy();
}

function getPreferredIndex() {
	//just before xkb layout indicator
	if (Main.panel._statusArea['keyboard'] != null) {
		let xkb = Main.panel._statusArea['keyboard'];
		let children = Main.panel._rightBox.get_children();

		let i;
		for (i = children.length - 1; i >= 0; i--) {
			if(xkb == children[i]._delegate){
				return i;
			}
		}
	}
	return 0;
}


function LockKeysIndicator() {
	this._init();
}

LockKeysIndicator.prototype = {
	__proto__: PanelMenu.Button.prototype,

	_init: function() {
		PanelMenu.Button.prototype._init.call(this, St.Align.START);

		// For highlight to work properly you have to use themed
		// icons. Fortunately we can add our directory to the search path.
		Gtk.IconTheme.get_default().append_search_path(Meta.path);

		this.numIcon = new St.Icon({icon_name: "numlock-enabled",
			icon_type: St.IconType.SYMBOLIC,
			style_class: 'system-status-icon'});
		this.capsIcon = new St.Icon({icon_name: "capslock-enabled",
			icon_type: St.IconType.SYMBOLIC,
			style_class: 'system-status-icon'});

		this.layoutManager = new St.BoxLayout({vertical: false,
			style_class: 'lockkeys-container'});
		this.layoutManager.add(this.numIcon);
		this.layoutManager.add(this.capsIcon);

		this.actor.add_actor(this.layoutManager);

		this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_('Num Lock'), false, { reactive: true });
		this.numMenuItem.connect('toggled', Lang.bind(this, this._handleNumlockMenuItem));
		this.menu.addMenuItem(this.numMenuItem);

		this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_('Caps Lock'), false, { reactive: true });
		this.capsMenuItem.connect('toggled', Lang.bind(this, this._handleCapslockMenuItem));
		this.menu.addMenuItem(this.capsMenuItem);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.notificationsMenuItem = new PopupMenu.PopupSwitchMenuItem(_('Notifications'), false, { reactive: true });
		this.notificationsMenuItem.connect('toggled', Lang.bind(this, this._handleNotificationsMenuItem));
		this.menu.addMenuItem(this.notificationsMenuItem);

		this._readprefs();
	},

	setActive: function(enabled) {
		if (enabled) {
			this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._handleStateChange));
			this._updateState();
		} else {
			Keymap.disconnect(this._keyboardStateChangedId);
		}
	}, 

	_handleNumlockMenuItem: function(actor, event) {
		keyval = Gdk.keyval_from_name("Num_Lock");
		Caribou.XAdapter.get_default().keyval_press(keyval);
		Caribou.XAdapter.get_default().keyval_release(keyval);
	}, 

	_handleCapslockMenuItem: function(actor, event) {
		keyval = Gdk.keyval_from_name("Caps_Lock");
		Caribou.XAdapter.get_default().keyval_press(keyval);
		Caribou.XAdapter.get_default().keyval_release(keyval);
	},

	_handleNotificationsMenuItem: function(actor, event) {
		this._writeprefs();
	},

	_handleStateChange: function(actor, event) {
		if (this.numlock_state != this._getNumlockState()) {
			let notification_text = _('Num Lock') + ' ' + this._getStateText(this._getNumlockState());
			if (this.notificationsMenuItem.state) {
				this._showNotification(notification_text, "numlock-enabled");
			}
		}
		if (this.capslock_state != this._getCapslockState()) {
			let notification_text = _('Caps Lock') + ' ' + this._getStateText(this._getCapslockState());
			if (this.notificationsMenuItem.state) {
				this._showNotification(notification_text, "capslock-enabled");
			}
		}
		this._updateState();
	}, 

	_updateState: function() {
		this.numlock_state = this._getNumlockState();
		this.capslock_state = this._getCapslockState();

		if (this.numlock_state)
			this.numIcon.set_icon_name("numlock-enabled");
		else
			this.numIcon.set_icon_name("numlock-disabled");

		if (this.capslock_state)
			this.capsIcon.set_icon_name("capslock-enabled");
		else
			this.capsIcon.set_icon_name("capslock-disabled");

		this.numMenuItem.setToggleState( this.numlock_state );
		this.capsMenuItem.setToggleState( this.capslock_state );
	},

	_showNotification: function(notification_text, icon_name) {
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
	},

	_prepareSource: function(icon_name) {
		if (this._source == null) {
			this._source = new MessageTray.SystemNotificationSource();
			this._source.createNotificationIcon = function() {
				return new St.Icon({ icon_name: icon_name,
					icon_type: St.IconType.SYMBOLIC,
					icon_size: this.ICON_SIZE });
			};
			this._source.connect('destroy', Lang.bind(this,
					function() {
				this._source = null;
			}));
			Main.messageTray.add(this._source);
		}
	},

	_getStateText: function(state) {
		return state ? _('On') : _('Off');
	},

	_getNumlockState: function() {
		return Keymap.get_num_lock_state();
	},

	_getCapslockState: function() {
		return Keymap.get_caps_lock_state();
	},

	_readprefs: function() {
		let prefs = JSON.parse(EXTENSION_PREFS);
		let _configFile = GLib.get_user_config_dir() + CONFIG_FILE;

		if (GLib.file_test(_configFile, GLib.FileTest.EXISTS)) {
			try {
				let filedata = GLib.file_get_contents(_configFile);
				global.log(_("Lockkeys: Reading configuration from = ") + _configFile);
				prefs = JSON.parse(filedata[1]);
			}
			catch (e) {
				global.logError(_("Lockkeys: Error reading config file = ") + e);
			}
		}

		this.notificationsMenuItem.setToggleState(prefs.notifications);
	},

	_writeprefs: function() {
		let prefs = JSON.parse(EXTENSION_PREFS);
		prefs.notifications = this.notificationsMenuItem.state;
		
		let _configDir = GLib.get_user_config_dir() + CONFIG_DIR;
		if (!GLib.file_test(_configDir, GLib.FileTest.EXISTS | GLib.FileTest.IS_DIR)) {
			GLib.mkdir_with_parents(_configDir, 0755);
		}
		try {		
			let _configFile = GLib.get_user_config_dir() + CONFIG_FILE;
			let filedata = JSON.stringify(prefs, null, "  ");
	        GLib.file_set_contents(_configFile, filedata, filedata.length);
		} 
		catch (e) {
			global.logError(_("Lockkeys: Error writing config file = ") + e);
		}
	},
}
