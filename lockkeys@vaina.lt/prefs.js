const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('lockkeys');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Meta = ExtensionUtils.getCurrentExtension();
const Utils = Meta.imports.utils;
const Config = imports.misc.config;

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
const POST_40 = parseFloat(Config.PACKAGE_VERSION) >= 40;

let settings;

function init() {
	settings = Utils.getSettings(Meta);
	Utils.initTranslations("lockkeys");
}

function buildPrefsWidget() {
	let indicator_style = createComboBox(STYLE, _("Indicator Style"), _("Change indicator display options"), {
		[STYLE_NONE]: _("Notifications Only"),
		[STYLE_NUMLOCK_ONLY]: _("Num-Lock Only"),
		[STYLE_CAPSLOCK_ONLY]: _("Caps-Lock Only"),
		[STYLE_BOTH]: _("Both"),
		[STYLE_SHOWHIDE]: _("Show/Hide"),
        [STYLE_SHOWHIDE_CAPSLOCK]: _("Show/Hide Caps-Lock Only")
	});

	let notifications_style = createComboBox(NOTIFICATIONS, _("Notifications"), _("Show notifications when state changes"), {
		[NOTIFICATIONS_OFF]: _("Off"),
		[NOTIFICATIONS_ON]: _("Compact"),
		[NOTIFICATIONS_OSD]: _("Osd")
	});

    return createVerticalBoxCompat(indicator_style, notifications_style);
}

function createComboBox(key, text, tooltip, values) {
	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
	let widget = new Gtk.ComboBoxText();
	widget.halign = Gtk.Align.END;
	for (let id in values) {
		widget.append(id, values[id]);
	}

	widget.set_active_id(settings.get_string(key));
	widget.connect('changed', function(combo_widget) {
		settings.set_string(key, combo_widget.get_active_id());
	});

	return createHorizontalBoxCompat(label, widget);
}

function createVerticalBoxCompat(...widgets) {
    if (POST_40) {
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });
        widgets.forEach(widget => box.append(widget));
        box.show();
        return box;
    } else {
        let box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin: 20});
        widgets.forEach(widget => box.add(widget));
        box.show_all();
        return box;
    }
}

function createHorizontalBoxCompat(label, widget) {
    let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, homogeneous: true});
    if (POST_40) {
        box.append(label);
        box.append(widget);
    } else {
        box.pack_start(label, true, true, 0);
        box.add(widget);
    }
    return box;
}