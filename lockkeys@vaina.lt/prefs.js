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

        // Header Suffixes are temporary commented out. The idea is to have them
        // act as a master switch for each group, but for now, this isn't implemented.

        // Set up Caps Lock group
        const capsGroup = new Adw.PreferencesGroup({
            title: _('Caps Lock'),
            description: _('Options for Caps Lock key'),
            /*header_suffix: new Gtk.Switch({
                active: this.getSettings().get_boolean('capslock-enabled'),
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Enable/Disable Caps Lock key indicator')
            })*/
        });
        /*capsGroup.header_suffix.connect('notify::active', (widget) => {
            this.getSettings().set_boolean('capslock-enabled', widget.active);
        });*/

        capsGroup.add(this.buildCapsLockPrefsWidget());

        // Set up Num Lock group
        const numlockGroup = new Adw.PreferencesGroup({
            title: _('Num Lock'),
            description: _('Options for Num Lock key'),
            /*header_suffix: new Gtk.Switch({
                active: this.getSettings().get_boolean('numlock-enabled'),
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Enable/Disable Num Lock key indicator')
            })*/
        });
        /*numlockGroup.header_suffix.connect('notify::active', (widget) => {
            this.getSettings().set_boolean('numlock-enabled', widget.active);
        });*/

        numlockGroup.add(this.buildNumLockPrefsWidget());

        const page = new Adw.PreferencesPage();
        page.add(capsGroup);
        page.add(numlockGroup);

        window.add(page);
    }

    buildCapsLockPrefsWidget() {
        const widget = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 });

        const capsNotification = this.createToggleGroup(
            'capslock-notification',
            _('Notifications'),
            _('Show notifications when state changes'),
            {
                'off': _('Off'),
                'compact': _('Compact'),
                'osd': _('Osd')
            }
        );
        widget.append(capsNotification);

        const capsIndicator = this.createToggleGroup(
            'capslock-indicator',
            _('Top Bar Indicator'),
            _('Show Caps Lock indicator in the top bar'),
            {
                'never': _('Never'),
                'when-active': _('When Active'),
                'always': _('Always')
            }
        );
        widget.append(capsIndicator);

        return this.createVerticalBoxCompat(widget);
    }

    buildNumLockPrefsWidget() {
        const widget = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 });

        const numlockNotification = this.createToggleGroup(
            'numlock-notification',
            _('Notifications'),
            _('Show notifications when state changes'),
            {
                'off': _('Off'),
                'compact': _('Compact'),
                'osd': _('Osd')
            }
        );
        widget.append(numlockNotification);

        const numlockIndicator = this.createToggleGroup(
            'numlock-indicator',
            _('Top Bar Indicator'),
            _('Show Num Lock indicator in the top bar'),
            {
                'never': _('Never'),
                'when-active': _('When Active'),
                'always': _('Always')
            }
        );
        widget.append(numlockIndicator);

        return this.createVerticalBoxCompat(widget);
    }

    createToggleGroup(key, text, tooltip, values) {
        let label = new Gtk.Label({ label: text, xalign: 0, tooltip_text:tooltip });
        label.set_hexpand(true);
        let widget = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        widget.halign = Gtk.Align.END;
        widget.get_style_context().add_class('linked');

        let firstButton = null;
        const _settings = this.getSettings();
        for (let id in values) {
            let button = new Gtk.ToggleButton({ label: values[id], active: _settings.get_string(key) === id });
            if (firstButton === null) {
                firstButton = button;
            } else {
                button.set_group(firstButton);
            }
            button.connect('toggled', function(toggle_widget) {
                if (toggle_widget.active) {
                    _settings.set_string(key, id);
                }
            });
            widget.append(button);
        }

        return this.createHorizontalBoxCompat(label, widget, false);
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

    createHorizontalBoxCompat(label, widget, homogenousity = true) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, homogeneous: homogenousity});
        box.append(label);
        box.append(widget);
        return box;
    }
}
