const St = imports.gi.St;
const Lang = imports.lang;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

const Keymap = imports.gi.Gdk.Keymap;
const Caribou = imports.gi.Caribou;

const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

let indicator;

function main() {
	init();
	enable();
}

function init() {
	indicator = new LockKeysIndicator();
}

function enable() {
	//Main.panel.addToStatusArea('numlock', indicator, getPreferredIndex());
	Main.panel._rightBox.insert_actor(indicator.actor,  getPreferredIndex());
	Main.panel._menus.addMenu(indicator.menu);
}

function disable() {
	//indicator.destroy();
	Main.panel._rightBox.remove_actor(indicator.actor);
	Main.panel._menus.removeMenu(indicator.menu);
}

function getPreferredIndex() {
	//just before xkb layout indicator
	if (Main.panel._statusArea['keyboard'] != null) {
		let xkb = Main.panel._statusArea['keyboard'];
		let children = Main.panel._rightBox.get_children();
		
		let i;
		for (i = children.length - 1; i >= 0; i--) {
			//global.log("i:" + i + " role pos " +  children[i]._rolePosition);
			if(xkb == children[i]._delegate){
				//return children[i]._rolePosition;
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

		this.capsLabel = new St.Label({text: 'A'});
		this.numLabel = new St.Label({ text: '1'});
		
		this.layoutManager = new St.BoxLayout({vertical: false});
		this.layoutManager.add(this.capsLabel);
		this.layoutManager.add(this.numLabel);
		
		this.actor.add_actor(this.layoutManager);
		
		this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_('Numlock'), false, { reactive: true });
		this.numMenuItem.connect('activate', Lang.bind(this, this._handleNumlockMenuItem));
		this.menu.addMenuItem(this.numMenuItem);

		this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_('Capslock'), false, { reactive: true });
		this.capsMenuItem.connect('activate', Lang.bind(this, this._handleCapslockMenuItem));
		this.menu.addMenuItem(this.capsMenuItem);
		
		this._updateState();
		Keymap.get_default().connect('state-changed', Lang.bind(this, this._handleStateChange));
	},
	
	_handleNumlockMenuItem: function(actor, event) {
		Caribou.XAdapter.get_default().keyval_press(0xff7f);
		Caribou.XAdapter.get_default().keyval_release(0xff7f);
		//global.log("handled by numlock");
	}, 
	
	_handleCapslockMenuItem: function(actor, event) {
		Caribou.XAdapter.get_default().keyval_press(0xffe5);
		Caribou.XAdapter.get_default().keyval_release(0xffe5);
		//global.log("handled by capslock");
	}, 
	
	_handleStateChange: function(actor, event) {
		if (this.numlock_state != this._getNumlockState()) {
			let notification_text = _('Numlock') + ' ' + this._getStateText(this._getNumlockState());
			this._showNotification(notification_text);
		}
		if (this.capslock_state != this._getCapslockState()) {
			let notification_text = _('Capslock') + ' ' + this._getStateText(this._getCapslockState());
			this._showNotification(notification_text);
		}
		this._updateState();
	}, 

	_updateState: function() {
		this.numlock_state = this._getNumlockState();
		this.capslock_state = this._getCapslockState();
		this.numLabel.set_style_class_name( this._getStateClassName(this.numlock_state) );
		this.capsLabel.set_style_class_name( this._getStateClassName(this.capslock_state) );
		this.numMenuItem.setToggleState( this.numlock_state );
		this.capsMenuItem.setToggleState( this.capslock_state );
	},
	
	_showNotification: function(notification_text) {
		this._prepareSource();
		
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
	
	_prepareSource: function() {
		if (this._source == null) {
			this._source = new MessageTray.SystemNotificationSource();
			this._source.createNotificationIcon = function() {
				return new St.Icon({ icon_name: 'input-keyboard',
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
	
	_getStateClassName: function(state) {
		return state ? 'indicator-state-enabled' : 'indicator-state-disabled';
	},

	 _getStateText: function(state) {
		return state ? _('On') : _('Off');
	},

	 _getNumlockState: function() {
		return Keymap.get_default().get_num_lock_state();
	},
	
	_getCapslockState: function() {
		return Keymap.get_default().get_caps_lock_state();
	},
}
