const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('lockkeys');
const _ = Gettext.gettext;

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

let settings;

function init() {
	settings = Utils.getSettings(Meta);
	Utils.initTranslations("lockkeys");
}

function buildPrefsWidget() {
	let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
		border_width: 10, margin: 20});
	frame.set_spacing(10);

	frame.add(_createComboBox(STYLE, _("Indicator Style"), _("Change indicator display options"), {
		[STYLE_NUMLOCK]: _("Num-Lock Only"), 
		[STYLE_CAPSLOCK]: _("Caps-Lock Only"), 
		[STYLE_BOTH]: _("Both"), 
		[STYLE_SHOWHIDE]: _("Show/Hide")
	}));
	
	frame.add(_createComboBox(NOTIFICATIONS, _("Notifications"), _("Show notifications when state changes"), {
		[NOTIFICATIONS_OFF]: _("Off"), 
		[NOTIFICATIONS_ON]: _("Compact"), 
		[NOTIFICATIONS_OSD]: _("Osd")
	}));
	
	frame.show_all();
	return frame;
}

function _createCheckBox(key, text, tooltip) {
	let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
	let widget = new Gtk.Switch({ active: settings.get_boolean(key) });
	widget.connect('notify::active', function(switch_widget) {
		settings.set_boolean(key, switch_widget.active);
	});

	box.pack_start(label, true, true, 0);
	box.add(widget);
	return box;
}

function _createComboBox(key, text, tooltip, values)
{
	let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
	let widget = new Gtk.ComboBoxText();
	for (let id in values) {
		widget.append(id, values[id]);
	}
	widget.set_active_id(settings.get_string(key));
	widget.connect('changed', function(combo_widget) {
		settings.set_string(key, combo_widget.get_active_id());
	});
	box.pack_start(label, true, true, 0);
	box.add(widget);
	return box;
}