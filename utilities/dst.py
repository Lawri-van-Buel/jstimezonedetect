"""
Module for generating rules and for testing.
"""

import subprocess
import json
import sys

AMBIGUOUS_DST_ZONES = ['America/Denver', 'America/Mazatlan', 'America/Chicago', 'America/Mexico_City',
                       'America/Santiago', 'America/Asuncion', 'America/Campo_Grande', 'America/Montevideo',
                       'America/Sao_Paulo', 'Asia/Amman', 'Asia/Jerusalem', 'Asia/Beirut',
                       'Europe/Helsinki', 'Asia/Damascus', 'Africa/Cairo', 'Asia/Gaza', 'Pacific/Auckland',
                       'Pacific/Fiji', 'America/Los_Angeles', 'America/Santa_Isabel', 'America/New_York',
                       'America/Havana', 'America/Halifax', 'America/Goose_Bay', 'America/Godthab',
                       'America/Miquelon', 'Asia/Dubai', 'Asia/Yerevan', 'Asia/Jakarta', 'Asia/Krasnoyarsk',
                       'Asia/Shanghai', 'Asia/Irkutsk', 'Australia/Perth', 'Australia/Sydney',
                       'Australia/Lord_Howe', 'Asia/Tokyo', 'Asia/Yakutsk', 'Asia/Dhaka',
                       'Asia/Omsk', 'Australia/Brisbane', 'Asia/Vladivostok', 'Pacific/Noumea',
                       'Pacific/Majuro', 'Asia/Kamchatka', 'Pacific/Tongatapu',
                       'Pacific/Apia', 'Asia/Baghdad', 'Europe/Minsk', 'Europe/Moscow',
                       'Asia/Karachi', 'Asia/Yekaterinburg', 'Africa/Johannesburg']

OTHER_DST_ZONES = ['Europe/Berlin', 'Australia/Adelaide', 'Africa/Windhoek', 'Asia/Tehran',
                   'Asia/Baku', 'America/St_Johns', 'Atlantic/Azores', 'America/Adak',
                   'Europe/London', 'Pacific/Chatham', 'America/Anchorage', 'America/Noronha']

OTHER_TIMEZONES = ['America/Guatemala', 'Pacific/Pitcairn', 'Asia/Kolkata', 'Pacific/Kiritimati',
                   'Australia/Darwin', 'Pacific/Pago_Pago', 'Pacific/Honolulu', 'America/Bogota',
                   'Atlantic/Cape_Verde', 'America/Phoenix', 'America/Santo_Domingo', 'UTC',
                   'Asia/Kathmandu', 'America/Argentina/Buenos_Aires', 'Pacific/Marquesas',
                   'Pacific/Norfolk', 'Asia/Kabul', 'Africa/Lagos', 'Pacific/Gambier', 'Asia/Rangoon',
                   'Etc/GMT+12', 'Australia/Eucla', 'America/Caracas']


YEARS = [2008, 2009, 2010, 2011, 2012, 2013, 2014]


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

    with open('rules.json', 'w') as rulefile:
        rulefile.write(json.dumps(rules, sort_keys=True, indent=4, separators=(',', ': ')))

    print "Written to rules.json"
    exit(1)


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
        exit(0)

    if sys.argv[1] == 'generate':
        generate_rules()

    if sys.argv[1] == 'test':
        if len(sys.argv) > 2 and sys.argv[2] == 'include-success':
            test(True)
        else:
            test()
