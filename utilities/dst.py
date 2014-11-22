"""
Module for generating rules and for testing.
"""

import subprocess
import json
import sys
from datetime import datetime

AMBIGUOUS_DST_ZONES = ['Africa/Cairo', 'America/Asuncion', 'America/Campo_Grande', 'America/Goose_Bay',
                       'America/Havana', 'America/Mazatlan', 'America/Mexico_City', 'America/Miquelon',
                       'America/Santa_Isabel', 'America/Sao_Paulo', 'Asia/Amman', 'Asia/Damascus',
                       'Asia/Dubai', 'Asia/Gaza', 'Asia/Irkutsk', 'Asia/Jerusalem', 'Asia/Kamchatka',
                       'Asia/Krasnoyarsk', 'Asia/Omsk', 'Asia/Vladivostok', 'Asia/Yakutsk', 'Asia/Yekaterinburg',
                       'Asia/Yerevan', 'Australia/Lord_Howe', 'Australia/Perth', 'Europe/Helsinki',
                       'Europe/Minsk', 'Europe/Moscow', 'Pacific/Apia', 'Pacific/Fiji']

OTHER_DST_ZONES = ['Africa/Johannesburg', 'Africa/Windhoek', 'America/Adak', 'America/Anchorage', 'America/Chicago',
                   'America/Denver', 'America/Godthab', 'America/Halifax', 'America/Los_Angeles', 'America/Montevideo',
                   'America/New_York', 'America/Noronha', 'America/Santiago', 'America/St_Johns', 'Asia/Baghdad',
                   'Asia/Baku', 'Asia/Beirut', 'Asia/Dhaka', 'Asia/Jakarta', 'Asia/Karachi', 'Asia/Shanghai',
                   'Asia/Tehran', 'Asia/Tokyo', 'Atlantic/Azores', 'Australia/Adelaide', 'Australia/Brisbane',
                   'Australia/Sydney', 'Europe/Berlin', 'Europe/London', 'Pacific/Auckland', 'Pacific/Chatham',
                   'Pacific/Majuro', 'Pacific/Noumea', 'Pacific/Tongatapu']

OTHER_TIMEZONES = ['America/Guatemala', 'Pacific/Pitcairn', 'Asia/Kolkata', 'Pacific/Kiritimati',
                   'Australia/Darwin', 'Pacific/Pago_Pago', 'Pacific/Honolulu', 'America/Bogota',
                   'Atlantic/Cape_Verde', 'America/Phoenix', 'America/Santo_Domingo', 'UTC',
                   'Asia/Kathmandu', 'America/Argentina/Buenos_Aires', 'Pacific/Marquesas',
                   'Pacific/Norfolk', 'Asia/Kabul', 'Africa/Lagos', 'Pacific/Gambier', 'Asia/Rangoon',
                   'Etc/GMT+12', 'Australia/Eucla', 'America/Caracas']

YEARS = range(2008, 2015)


def generate_rules():
    rules = {'years': YEARS}
    zones = []

    for timezone in AMBIGUOUS_DST_ZONES:
        print timezone

        call_args = ['node', 'dst.js', timezone] + [str(y) for y in YEARS]
        result = {
            'name': timezone,
            'rules': json.loads(subprocess.check_output(call_args))
        }
        zones.append(result)

    rules['zones'] = zones

    rules_json = json.dumps(rules, sort_keys=True, indent=4, separators=(',', ': '))

    rules_js = """/* Build time: %s */
(function () {
var jstz = exports.jstz || root.jstz;
jstz.olson = jstz.olson || jstz.olson;
jstz.olson.dst_rules = %s;
}());""" % (datetime.utcnow().strftime('%Y-%m-%d %H:%M:%SZ'), rules_json)

    with open('../rules.js', 'w') as rulefile:
        rulefile.write(rules_js)

    print "Written to ../rules.js"


def test(include_success=False):
    all_timezones = AMBIGUOUS_DST_ZONES + OTHER_DST_ZONES + OTHER_TIMEZONES
    success = True
    for timezone in all_timezones:

        call_args = ['node', 'test.js', timezone]
        output = subprocess.check_output(call_args)

        if "Assertion failed" in output or include_success:
            print output.replace('\n', '')
            success = False

    if success:
        print "All tests succeeded (%s zones successfully detected)" % len(all_timezones)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print "Supply arguments 'generate' or 'test'"
        exit()

    if sys.argv[1] == 'generate':
        generate_rules()

    if sys.argv[1] == 'test':
        if len(sys.argv) > 2 and sys.argv[2] == 'include-success':
            test(True)
        else:
            test()
