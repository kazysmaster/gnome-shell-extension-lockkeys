import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

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

export default class LockKeysPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const group = new Adw.PreferencesGroup({
            title: _('Settings'),
            description: _('Change indicator display options')
        });
        group.add(this.buildPrefsWidget());
        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);
    }

    buildPrefsWidget() {
    	const indicator_style = this.createComboBox(
    	    STYLE,
    	    _("Indicator Style"),
    	    _("Change indicator display options"),
    	    {
                [STYLE_NONE]: _("Notifications Only"),
                [STYLE_NUMLOCK_ONLY]: _("Num-Lock Only"),
                [STYLE_CAPSLOCK_ONLY]: _("Caps-Lock Only"),
                [STYLE_BOTH]: _("Both"),
                [STYLE_SHOWHIDE]: _("Show/Hide"),
                [STYLE_SHOWHIDE_CAPSLOCK]: _("Show/Hide Caps-Lock Only")
    	    }
    	);

    	const notifications_style = this.createComboBox(
    	    NOTIFICATIONS,
    	    _("Notifications"),
    	    _("Show notifications when state changes"),
    	    {
                [NOTIFICATIONS_OFF]: _("Off"),
                [NOTIFICATIONS_ON]: _("Compact"),
                [NOTIFICATIONS_OSD]: _("Osd")
    	    }
    	);

        return this.createVerticalBoxCompat(indicator_style, notifications_style);
    }

    createComboBox(key, text, tooltip, values) {
    	let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
    	let widget = new Gtk.ComboBoxText();
    	widget.halign = Gtk.Align.END;
    	for (let id in values) {
    		widget.append(id, values[id]);
    	}

    	const _settings = this.getSettings();
    	widget.set_active_id(_settings.get_string(key));
    	widget.connect('changed', function(combo_widget) {
    		_settings.set_string(key, combo_widget.get_active_id());
    	});

    	return this.createHorizontalBoxCompat(label, widget);
    }

    createVerticalBoxCompat(...widgets) {
        const box = new Gtk.Box({
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
    }

    createHorizontalBoxCompat(label, widget) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, homogeneous: true});
        box.append(label);
        box.append(widget);
        return box;
    }
}
