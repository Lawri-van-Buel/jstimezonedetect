/*global exports, Intl*/
/**
 * This script gives you the zone info key representing your device's time zone setting.
 *
 * @name jsTimezoneDetect
 * @version 1.0.5
 * @author Jon Nylander
 * @license MIT License - https://bitbucket.org/pellepim/jstimezonedetect/src/default/LICENCE.txt
 *
 * For usage and examples, visit:
 * http://pellepim.bitbucket.org/jstz/
 *
 * Copyright (c) Jon Nylander
 */


(function (root) {
    /**
     * Namespace to hold all the code for timezone detection.
     */
    var jstz = (function () {
        'use strict';
        var HEMISPHERE_SOUTH = 's',

            consts = {
                DAY: 86400000,
                HOUR: 3600000,
                MINUTE: 60000,
                SECOND: 1000,
                BASELINE_YEAR: 2014,
                MAX_SCORE: 864000000, // 10 days
                AMBIGUITIES: {
                    'America/Denver':       ['America/Mazatlan'],
                    'America/Chicago':      ['America/Mexico_City'],
                    'America/Santiago':     ['America/Asuncion', 'America/Campo_Grande'],
                    'America/Montevideo':   ['America/Sao_Paulo'],
                    // Europe/Minsk should not be in this list... but Windows.
                    'Asia/Beirut':          ['Asia/Amman', 'Asia/Jerusalem', 'Europe/Helsinki', 'Asia/Damascus', 'Africa/Cairo', 'Asia/Gaza', 'Europe/Minsk'],
                    'Pacific/Auckland':     ['Pacific/Fiji'],
                    'America/Los_Angeles':  ['America/Santa_Isabel'],
                    'America/New_York':     ['America/Havana'],
                    'America/Halifax':      ['America/Goose_Bay'],
                    'America/Godthab':      ['America/Miquelon'],
                    'Asia/Dubai':           ['Asia/Yerevan'],
                    'Asia/Jakarta':         ['Asia/Krasnoyarsk'],
                    'Asia/Shanghai':        ['Asia/Irkutsk', 'Australia/Perth'],
                    'Australia/Sydney':     ['Australia/Lord_Howe'],
                    'Asia/Tokyo':           ['Asia/Yakutsk'],
                    'Asia/Dhaka':           ['Asia/Omsk'],
                    // In the real world Yerevan is not ambigous for Baku... but Windows.
                    'Asia/Baku':            ['Asia/Yerevan'],
                    'Australia/Brisbane':   ['Asia/Vladivostok'],
                    'Pacific/Noumea':       ['Asia/Vladivostok'],
                    'Pacific/Majuro':       ['Asia/Kamchatka', 'Pacific/Fiji'],
                    'Pacific/Tongatapu':    ['Pacific/Apia'],
                    'Asia/Baghdad':         ['Europe/Minsk', 'Europe/Moscow'],
                    'Asia/Karachi':         ['Asia/Yekaterinburg'],
                    'Africa/Johannesburg':  ['Asia/Gaza', 'Africa/Cairo']
                }
            },

            /**
             * Gets the offset in minutes from UTC for a certain date.
             * @param {Date} date
             * @returns {Number}
             */
            get_date_offset = function get_date_offset(date) {
                var offset = -date.getTimezoneOffset();
                return (offset !== null ? offset : 0);
            },

            /**
             * This function does some basic calculations to create information about
             * the user's timezone. It uses REFERENCE_YEAR as a solid year for which
             * the script has been tested rather than depend on the year set by the
             * client device.
             *
             * Returns a key that can be used to do lookups in jstz.olson.timezones.
             * eg: "720,1,2".
             *
             * @returns {String}
             */
            lookup_key = function lookup_key() {
                var january_offset = get_date_offset(new Date(consts.BASELINE_YEAR, 0, 2)),
                    june_offset = get_date_offset(new Date(consts.BASELINE_YEAR, 5, 2)),
                    diff = january_offset - june_offset;

                if (diff < 0) {
                    return january_offset + ",1";
                } else if (diff > 0) {
                    return june_offset + ",1," + HEMISPHERE_SOUTH;
                }

                return january_offset + ",0";
            },


            /**
             * Tries to get the time zone key directly from the operating system for those
             * environments that support the ECMAScript Internationalization API.
             */
            get_from_internationalization_api = function get_from_internationalization_api() {
                if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") {
                    return;
                }
                var format = Intl.DateTimeFormat();
                if (typeof format === "undefined" || typeof format.resolvedOptions === "undefined") {
                    return;
                }
                return format.resolvedOptions().timeZone;
            },

            /**
             * Starting point for getting all the DST rules for a specific year
             * for the current timezone (as described by the client system).
             *
             * Returns an object with start and end attributes, or false if no
             * DST rules were found for the year.
             *
             * @param year
             * @returns {Object} || {Boolean}
             */
            dst_dates = function dst_dates(year) {
                var yearstart = new Date(year, 0, 1, 0, 0, 1, 0).getTime();
                var yearend = new Date(year, 12, 31, 23, 59, 59).getTime();
                var current = yearstart;
                var offset = (new Date(current)).getTimezoneOffset();
                var dst_start = null;
                var dst_end = null;

                while (current < yearend - 86400000) {
                    var dateToCheck = new Date(current);
                    var dateToCheckOffset = dateToCheck.getTimezoneOffset();

                    if (dateToCheckOffset !== offset) {
                        if (dateToCheckOffset < offset) {
                            dst_start = dateToCheck;
                        }
                        if (dateToCheckOffset > offset) {
                            dst_end = dateToCheck;
                        }
                        offset = dateToCheckOffset;
                    }

                    current += 86400000;
                }

                if (dst_start && dst_end) {
                    return {
                        start: find_dst_fold(dst_start).getTime(),
                        end: find_dst_fold(dst_end).getTime()
                    }
                }

                return false;
            },

            /**
             * Probably completely unnecessary function that recursively finds the
             * exact (to the second) time when a DST rule was changed.
             *
             * @param a_date - The candidate Date.
             * @param padding - integer specifying the padding to allow around the candidate
             *                  date for finding the fold.
             * @param iterator - integer specifying how many milliseconds to iterate while
             *                   searching for the fold.
             *
             * @returns {Date}
             */
            find_dst_fold = function find_dst_fold(a_date, padding, iterator) {
                if (typeof padding === 'undefined') {
                    padding = consts.DAY;
                    iterator = consts.HOUR;
                }

                var date_start = new Date(a_date.getTime() - padding).getTime();
                var date_end = a_date.getTime() + padding;
                var offset = new Date(date_start).getTimezoneOffset();

                var current = date_start;

                var dst_change = null;
                while (current < date_end - iterator) {
                    var dateToCheck = new Date(current);
                    var dateToCheckOffset = dateToCheck.getTimezoneOffset();

                    if (dateToCheckOffset !== offset) {
                        dst_change = dateToCheck;
                        break;
                    }
                    current += iterator;
                }

                if (padding === consts.DAY) {
                    return find_dst_fold(dst_change, consts.HOUR, consts.MINUTE);
                }

                if (padding === consts.HOUR) {
                    return find_dst_fold(dst_change, consts.MINUTE, consts.SECOND);
                }

                return dst_change;
            },

            windows7_adaptations = function windows7_adaptions(rule_list, preliminary_timezone, score, sample) {
                if (score !== 'N/A') {
                    return score;
                }
                if (preliminary_timezone === 'Asia/Beirut') {
                    if (sample.name === 'Africa/Cairo') {
                        if (rule_list[6].start === 1398376800000 && rule_list[6].end === 1411678800000) {
                            return 0;
                        }
                    }
                    if (sample.name === 'Asia/Jerusalem') {
                        if (rule_list[6].start === 1395964800000 && rule_list[6].end === 1411858800000) {
                            return 0;
                    }
                }
                } else if (preliminary_timezone === 'America/Santiago') {
                    if (sample.name === 'America/Asuncion') {
                        if (rule_list[6].start === 1412481600000 && rule_list[6].end === 1397358000000) {
                            return 0;
                        }
                    }
                    if (sample.name === 'America/Campo_Grande') {
                        if (rule_list[6].start === 1413691200000 && rule_list[6].end === 1392519600000) {
                            return 0;
                        }
                    }
                } else if (preliminary_timezone === 'America/Montevideo') {
                    if (sample.name === 'America/Sao_Paulo') {
                        if (rule_list[6].start === 1413687600000 && rule_list[6].end === 1392516000000) {
                            return 0;
                        }
                    }
                } else if (preliminary_timezone === 'Pacific/Auckland') {
                    if (sample.name === 'Pacific/Fiji') {
                        if (rule_list[6].start === 1414245600000 && rule_list[6].end === 1396101600000) {
                            return 0;
                        }
                    }
                }

                return score;
            },

            /**
             * Takes the DST rules for the current timezone, and proceeds to find matches
             * in the jstz.olson.dst_rules.zones array.
             *
             * Compares samples to the current timezone on a scoring basis.
             *
             * Candidates are ruled immediately if either the candidate or the current zone
             * has a DST rule where the other does not.
             *
             * Candidates are ruled out immediately if the current zone has a rule that is
             * outside the DST scope of the candidate.
             *
             * Candidates are included for scoring if the current zones rules fall within the
             * span of the samples rules.
             *
             * Low score is best, the score is calculated by summing up the differences in DST
             * rules and if the consts.MAX_SCORE is overreached the candidate is ruled out.
             *
             * Yah follow? :)
             *
             * @param rule_list
             * @param preliminary_timezone
             * @returns {*}
             */
            best_dst_match = function best_dst_match(rule_list, preliminary_timezone) {
                var score_sample = function score_sample(sample) {
                    var score = 0;

                    for (var j = 0; j < rule_list.length; j++) {

                        // Both sample and current time zone report DST during the year.
                        if (!!sample.rules[j] && !!rule_list[j]) {

                            // The current time zone's DST rules are inside the sample's. Include.
                            if (rule_list[j].start >= sample.rules[j].start && rule_list[j].end <= sample.rules[j].end) {
                                score = 0;
                                score += Math.abs(rule_list[j].start - sample.rules[j].start);
                                score += Math.abs(sample.rules[j].end - rule_list[j].end);

                            // The current time zone's DST rules are outside the sample's. Discard.
                            } else {
                                score = 'N/A';
                                break;
                            }

                            // The max score has been reached. Discard.
                            if (score > consts.MAX_SCORE) {
                                score = 'N/A';
                                break;
                            }
                        }
                    }
                    
                    score = windows7_adaptations(rule_list, preliminary_timezone, score, sample);

                    return score;
                };
                var scoreboard = {};
                var dst_zones = jstz.olson.dst_rules.zones;
                var dst_zones_length = dst_zones.length;
                var ambiguities = consts.AMBIGUITIES[preliminary_timezone];

                for (var i = 0; i < dst_zones_length; i++) {
                    var sample = dst_zones[i];
                    var score = score_sample(dst_zones[i]);

                    if (score !== 'N/A') {
                        scoreboard[sample.name] = score;
                    }
                }

                for (score in scoreboard) {
                    if (scoreboard.hasOwnProperty(score)) {
                        if (ambiguities.indexOf(score) != -1) {
                            return score;
                        }
                    }
                }

                return preliminary_timezone;
            },

            /**
             * Takes the preliminary_timezone as detected by lookup_key().
             *
             * Builds up the current timezones DST rules for the years defined
             * in the jstz.olson.dst_rules.years array.
             *
             * If there are no DST occurences for those years, immediately returns
             * the preliminary timezone. Otherwise proceeds and tries to solve
             * ambiguities.
             *
             * @param preliminary_timezone
             * @returns {String} timezone_name
             */
            get_by_dst = function get_by_dst(preliminary_timezone) {
                var get_rules = function get_rules() {
                    var rule_list = [];
                    for (var i = 0; i < jstz.olson.dst_rules.years.length; i++) {
                        var year_rules = dst_dates(jstz.olson.dst_rules.years[i]);
                        rule_list.push(year_rules);
                    }
                    return rule_list;
                };
                var check_has_dst = function check_has_dst(rules) {
                    for (var i = 0; i < rules.length; i++) {
                        if (rules[i] !== false) {
                            return true;
                        }
                    }
                    return false;
                };
                var rules = get_rules();
                var has_dst = check_has_dst(rules);

                if (has_dst) {
                    return best_dst_match(rules, preliminary_timezone);
                }

                return preliminary_timezone;
            },

            /**
             * Uses get_timezone_info() to formulate a key to use in the olson.timezones dictionary.
             *
             * Returns an object with one function ".name()"
             *
             * @returns Object
             */
            determine = function determine() {
                var preliminary_tz = get_from_internationalization_api();

                if (!preliminary_tz) {
                    preliminary_tz = jstz.olson.timezones[lookup_key()];

                    if (typeof consts.AMBIGUITIES[preliminary_tz] !== 'undefined') {
                        preliminary_tz = get_by_dst(preliminary_tz);
                    }
                }

                return {
                    name: function () {
                        return preliminary_tz;
                    }
                };
            };

        return {
            determine: determine
        };
    }());


    jstz.olson = {};

    /**
     * The keys in this dictionary are comma separated as such:
     *
     * First the offset compared to UTC time in minutes.
     *
     * Then a flag which is 0 if the timezone does not take daylight savings into account and 1 if it
     * does.
     *
     * Thirdly an optional 's' signifies that the timezone is in the southern hemisphere,
     * only interesting for timezones with DST.
     *
     * The mapped arrays is used for constructing the jstz.TimeZone object from within
     * jstz.determine();
     */
    jstz.olson.timezones = {
        '-720,0': 'Etc/GMT+12',
        '-660,0': 'Pacific/Pago_Pago',
        '-660,1,s': 'Pacific/Apia', // Why? Because windows... cry!
        '-600,1': 'America/Adak',
        '-600,0': 'Pacific/Honolulu',
        '-570,0': 'Pacific/Marquesas',
        '-540,0': 'Pacific/Gambier',
        '-540,1': 'America/Anchorage',
        '-480,1': 'America/Los_Angeles',
        '-480,0': 'Pacific/Pitcairn',
        '-420,0': 'America/Phoenix',
        '-420,1': 'America/Denver',
        '-360,0': 'America/Guatemala',
        '-360,1': 'America/Chicago',
        '-360,1,s': 'Pacific/Easter',
        '-300,0': 'America/Bogota',
        '-300,1': 'America/New_York',
        '-270,0': 'America/Caracas',
        '-240,1': 'America/Halifax',
        '-240,0': 'America/Santo_Domingo',
        '-240,1,s': 'America/Santiago',
        '-210,1': 'America/St_Johns',
        '-180,1': 'America/Godthab',
        '-180,0': 'America/Argentina/Buenos_Aires',
        '-180,1,s': 'America/Montevideo',
        '-120,0': 'America/Noronha',
        '-120,1': 'America/Noronha',
        '-60,1': 'Atlantic/Azores',
        '-60,0': 'Atlantic/Cape_Verde',
        '0,0': 'UTC',
        '0,1': 'Europe/London',
        '60,1': 'Europe/Berlin',
        '60,0': 'Africa/Lagos',
        '60,1,s': 'Africa/Windhoek',
        '120,1': 'Asia/Beirut',
        '120,0': 'Africa/Johannesburg',
        '180,0': 'Asia/Baghdad',
        '180,1': 'Europe/Moscow',
        '210,1': 'Asia/Tehran',
        '240,0': 'Asia/Dubai',
        '240,1': 'Asia/Baku',
        '270,0': 'Asia/Kabul',
        '300,1': 'Asia/Yekaterinburg',
        '300,0': 'Asia/Karachi',
        '330,0': 'Asia/Kolkata',
        '345,0': 'Asia/Kathmandu',
        '360,0': 'Asia/Dhaka',
        '360,1': 'Asia/Omsk',
        '390,0': 'Asia/Rangoon',
        '420,1': 'Asia/Krasnoyarsk',
        '420,0': 'Asia/Jakarta',
        '480,0': 'Asia/Shanghai',
        '480,1': 'Asia/Irkutsk',
        '525,0': 'Australia/Eucla',
        '525,1,s': 'Australia/Eucla',
        '540,1': 'Asia/Yakutsk',
        '540,0': 'Asia/Tokyo',
        '570,0': 'Australia/Darwin',
        '570,1,s': 'Australia/Adelaide',
        '600,0': 'Australia/Brisbane',
        '600,1': 'Asia/Vladivostok',
        '600,1,s': 'Australia/Sydney',
        '630,1,s': 'Australia/Lord_Howe',
        '660,1': 'Asia/Kamchatka',
        '660,0': 'Pacific/Noumea',
        '690,0': 'Pacific/Norfolk',
        '720,1,s': 'Pacific/Auckland',
        '720,0': 'Pacific/Majuro',
        '765,1,s': 'Pacific/Chatham',
        '780,0': 'Pacific/Tongatapu',
        '780,1,s': 'Pacific/Apia',
        '840,0': 'Pacific/Kiritimati'
    };
    jstz.olson.dst_rules = {
        "years": [
            2008,
            2009,
            2010,
            2011,
            2012,
            2013,
            2014
        ],
        "zones": [
            {
                "name": "America/Denver",
                "rules": [
                    {
                        "end": 1225612800000,
                        "start": 1205053200000
                    },
                    {
                        "end": 1257062400000,
                        "start": 1236502800000
                    },
                    {
                        "end": 1289116800000,
                        "start": 1268557200000
                    },
                    {
                        "end": 1320566400000,
                        "start": 1300006800000
                    },
                    {
                        "end": 1352016000000,
                        "start": 1331456400000
                    },
                    {
                        "end": 1383465600000,
                        "start": 1362906000000
                    },
                    {
                        "end": 1414915200000,
                        "start": 1394355600000
                    }
                ]
            },
            {
                "name": "America/Mazatlan",
                "rules": [
                    {
                        "end": 1225008000000,
                        "start": 1207472400000
                    },
                    {
                        "end": 1256457600000,
                        "start": 1238922000000
                    },
                    {
                        "end": 1288512000000,
                        "start": 1270371600000
                    },
                    {
                        "end": 1319961600000,
                        "start": 1301821200000
                    },
                    {
                        "end": 1351411200000,
                        "start": 1333270800000
                    },
                    {
                        "end": 1382860800000,
                        "start": 1365325200000
                    },
                    {
                        "end": 1414310400000,
                        "start": 1396774800000
                    }
                ]
            },
            {
                "name": "America/Chicago",
                "rules": [
                    {
                        "end": 1225609200000,
                        "start": 1205049600000
                    },
                    {
                        "end": 1257058800000,
                        "start": 1236499200000
                    },
                    {
                        "end": 1289113200000,
                        "start": 1268553600000
                    },
                    {
                        "end": 1320562800000,
                        "start": 1300003200000
                    },
                    {
                        "end": 1352012400000,
                        "start": 1331452800000
                    },
                    {
                        "end": 1383462000000,
                        "start": 1362902400000
                    },
                    {
                        "end": 1414911600000,
                        "start": 1394352000000
                    }
                ]
            },
            {
                "name": "America/Mexico_City",
                "rules": [
                    {
                        "end": 1225004400000,
                        "start": 1207468800000
                    },
                    {
                        "end": 1256454000000,
                        "start": 1238918400000
                    },
                    {
                        "end": 1288508400000,
                        "start": 1270368000000
                    },
                    {
                        "end": 1319958000000,
                        "start": 1301817600000
                    },
                    {
                        "end": 1351407600000,
                        "start": 1333267200000
                    },
                    {
                        "end": 1382857200000,
                        "start": 1365321600000
                    },
                    {
                        "end": 1414306800000,
                        "start": 1396771200000
                    }
                ]
            },
            {
                "name": "America/Santiago",
                "rules": [
                    {
                        "end": 1206846000000,
                        "start": 1223784000000
                    },
                    {
                        "end": 1237086000000,
                        "start": 1255233600000
                    },
                    {
                        "end": 1270350000000,
                        "start": 1286683200000
                    },
                    {
                        "end": 1304823600000,
                        "start": 1313899200000
                    },
                    {
                        "end": 1335668400000,
                        "start": 1346558400000
                    },
                    {
                        "end": 1367118000000,
                        "start": 1378612800000
                    },
                    {
                        "end": 1398567600000,
                        "start": 1410062400000
                    }
                ]
            },
            {
                "name": "America/Asuncion",
                "rules": [
                    {
                        "end": 1205031600000,
                        "start": 1224388800000
                    },
                    {
                        "end": 1236481200000,
                        "start": 1255838400000
                    },
                    {
                        "end": 1270954800000,
                        "start": 1286078400000
                    },
                    {
                        "end": 1302404400000,
                        "start": 1317528000000
                    },
                    {
                        "end": 1333854000000,
                        "start": 1349582400000
                    },
                    {
                        "end": 1364094000000,
                        "start": 1381032000000
                    },
                    {
                        "end": 1395543600000,
                        "start": 1412481600000
                    }
                ]
            },
            {
                "name": "America/Campo_Grande",
                "rules": [
                    {
                        "end": 1203217200000,
                        "start": 1224388800000
                    },
                    {
                        "end": 1234666800000,
                        "start": 1255838400000
                    },
                    {
                        "end": 1266721200000,
                        "start": 1287288000000
                    },
                    {
                        "end": 1298170800000,
                        "start": 1318737600000
                    },
                    {
                        "end": 1330225200000,
                        "start": 1350792000000
                    },
                    {
                        "end": 1361070000000,
                        "start": 1382241600000
                    },
                    {
                        "end": 1392519600000,
                        "start": 1413691200000
                    }
                ]
            },
            {
                "name": "America/Montevideo",
                "rules": [
                    {
                        "end": 1205035200000,
                        "start": 1223182800000
                    },
                    {
                        "end": 1236484800000,
                        "start": 1254632400000
                    },
                    {
                        "end": 1268539200000,
                        "start": 1286082000000
                    },
                    {
                        "end": 1299988800000,
                        "start": 1317531600000
                    },
                    {
                        "end": 1331438400000,
                        "start": 1349586000000
                    },
                    {
                        "end": 1362888000000,
                        "start": 1381035600000
                    },
                    {
                        "end": 1394337600000,
                        "start": 1412485200000
                    }
                ]
            },
            {
                "name": "America/Sao_Paulo",
                "rules": [
                    {
                        "end": 1203213600000,
                        "start": 1224385200000
                    },
                    {
                        "end": 1234663200000,
                        "start": 1255834800000
                    },
                    {
                        "end": 1266717600000,
                        "start": 1287284400000
                    },
                    {
                        "end": 1298167200000,
                        "start": 1318734000000
                    },
                    {
                        "end": 1330221600000,
                        "start": 1350788400000
                    },
                    {
                        "end": 1361066400000,
                        "start": 1382238000000
                    },
                    {
                        "end": 1392516000000,
                        "start": 1413687600000
                    }
                ]
            },
            {
                "name": "Asia/Amman",
                "rules": [
                    {
                        "end": 1225404000000,
                        "start": 1206655200000
                    },
                    {
                        "end": 1256853600000,
                        "start": 1238104800000
                    },
                    {
                        "end": 1288303200000,
                        "start": 1269554400000
                    },
                    {
                        "end": 1319752800000,
                        "start": 1301608800000
                    },
                    false,
                    false,
                    {
                        "end": 1414706400000,
                        "start": 1395957600000
                    }
                ]
            },
            {
                "name": "Asia/Jerusalem",
                "rules": [
                    {
                        "end": 1223161200000,
                        "start": 1206662400000
                    },
                    {
                        "end": 1254006000000,
                        "start": 1238112000000
                    },
                    {
                        "end": 1284246000000,
                        "start": 1269561600000
                    },
                    {
                        "end": 1317510000000,
                        "start": 1301616000000
                    },
                    {
                        "end": 1348354800000,
                        "start": 1333065600000
                    },
                    {
                        "end": 1382828400000,
                        "start": 1364515200000
                    },
                    {
                        "end": 1414278000000,
                        "start": 1395964800000
                    }
                ]
            },
            {
                "name": "Asia/Beirut",
                "rules": [
                    {
                        "end": 1224968400000,
                        "start": 1206828000000
                    },
                    {
                        "end": 1256418000000,
                        "start": 1238277600000
                    },
                    {
                        "end": 1288472400000,
                        "start": 1269727200000
                    },
                    {
                        "end": 1319922000000,
                        "start": 1301176800000
                    },
                    {
                        "end": 1351371600000,
                        "start": 1332626400000
                    },
                    {
                        "end": 1382821200000,
                        "start": 1364680800000
                    },
                    {
                        "end": 1414270800000,
                        "start": 1396130400000
                    }
                ]
            },
            {
                "name": "Europe/Helsinki",
                "rules": [
                    {
                        "end": 1224982800000,
                        "start": 1206838800000
                    },
                    {
                        "end": 1256432400000,
                        "start": 1238288400000
                    },
                    {
                        "end": 1288486800000,
                        "start": 1269738000000
                    },
                    {
                        "end": 1319936400000,
                        "start": 1301187600000
                    },
                    {
                        "end": 1351386000000,
                        "start": 1332637200000
                    },
                    {
                        "end": 1382835600000,
                        "start": 1364691600000
                    },
                    {
                        "end": 1414285200000,
                        "start": 1396141200000
                    }
                ]
            },
            {
                "name": "Asia/Damascus",
                "rules": [
                    {
                        "end": 1225486800000,
                        "start": 1207260000000
                    },
                    {
                        "end": 1256850000000,
                        "start": 1238104800000
                    },
                    {
                        "end": 1288299600000,
                        "start": 1270159200000
                    },
                    {
                        "end": 1319749200000,
                        "start": 1301608800000
                    },
                    {
                        "end": 1351198800000,
                        "start": 1333058400000
                    },
                    {
                        "end": 1382648400000,
                        "start": 1364508000000
                    },
                    {
                        "end": 1414702800000,
                        "start": 1395957600000
                    }
                ]
            },
            {
                "name": "Africa/Cairo",
                "rules": [
                    {
                        "end": 1219957200000,
                        "start": 1209074400000
                    },
                    {
                        "end": 1250802000000,
                        "start": 1240524000000
                    },
                    {
                        "end": 1285880400000,
                        "start": 1284069600000
                    },
                    false,
                    false,
                    false,
                    {
                        "end": 1411678800000,
                        "start": 1406844000000
                    }
                ]
            },
            {
                "name": "Asia/Gaza",
                "rules": [
                    {
                        "end": 1219957200000,
                        "start": 1206655200000
                    },
                    {
                        "end": 1252015200000,
                        "start": 1238104800000
                    },
                    {
                        "end": 1281474000000,
                        "start": 1269640860000
                    },
                    {
                        "end": 1312146000000,
                        "start": 1301608860000
                    },
                    {
                        "end": 1348178400000,
                        "start": 1333058400000
                    },
                    {
                        "end": 1380229200000,
                        "start": 1364508000000
                    },
                    {
                        "end": 1411678800000,
                        "start": 1395957600000
                    }
                ]
            },
            {
                "name": "Pacific/Auckland",
                "rules": [
                    {
                        "end": 1207404000000,
                        "start": 1222524000000
                    },
                    {
                        "end": 1238853600000,
                        "start": 1253973600000
                    },
                    {
                        "end": 1270303200000,
                        "start": 1285423200000
                    },
                    {
                        "end": 1301752800000,
                        "start": 1316872800000
                    },
                    {
                        "end": 1333202400000,
                        "start": 1348927200000
                    },
                    {
                        "end": 1365256800000,
                        "start": 1380376800000
                    },
                    {
                        "end": 1396706400000,
                        "start": 1411826400000
                    }
                ]
            },
            {
                "name": "Pacific/Fiji",
                "rules": [
                    false,
                    false,
                    {
                        "end": 1269698400000,
                        "start": 1287842400000
                    },
                    {
                        "end": 1327154400000,
                        "start": 1319292000000
                    },
                    {
                        "end": 1358604000000,
                        "start": 1350741600000
                    },
                    {
                        "end": 1390050000000,
                        "start": 1382796000000
                    },
                    {
                        "end": 1421503200000,
                        "start": 1414850400000
                    }
                ]
            },
            {
                "name": "America/Los_Angeles",
                "rules": [
                    {
                        "end": 1225616400000,
                        "start": 1205056800000
                    },
                    {
                        "end": 1257066000000,
                        "start": 1236506400000
                    },
                    {
                        "end": 1289120400000,
                        "start": 1268560800000
                    },
                    {
                        "end": 1320570000000,
                        "start": 1300010400000
                    },
                    {
                        "end": 1352019600000,
                        "start": 1331460000000
                    },
                    {
                        "end": 1383469200000,
                        "start": 1362909600000
                    },
                    {
                        "end": 1414918800000,
                        "start": 1394359200000
                    }
                ]
            },
            {
                "name": "America/Santa_Isabel",
                "rules": [
                    {
                        "end": 1225011600000,
                        "start": 1207476000000
                    },
                    {
                        "end": 1256461200000,
                        "start": 1238925600000
                    },
                    {
                        "end": 1288515600000,
                        "start": 1270375200000
                    },
                    {
                        "end": 1319965200000,
                        "start": 1301824800000
                    },
                    {
                        "end": 1351414800000,
                        "start": 1333274400000
                    },
                    {
                        "end": 1382864400000,
                        "start": 1365328800000
                    },
                    {
                        "end": 1414314000000,
                        "start": 1396778400000
                    }
                ]
            },
            {
                "name": "America/New_York",
                "rules": [
                    {
                        "end": 1225605600000,
                        "start": 1205046000000
                    },
                    {
                        "end": 1257055200000,
                        "start": 1236495600000
                    },
                    {
                        "end": 1289109600000,
                        "start": 1268550000000
                    },
                    {
                        "end": 1320559200000,
                        "start": 1299999600000
                    },
                    {
                        "end": 1352008800000,
                        "start": 1331449200000
                    },
                    {
                        "end": 1383458400000,
                        "start": 1362898800000
                    },
                    {
                        "end": 1414908000000,
                        "start": 1394348400000
                    }
                ]
            },
            {
                "name": "America/Havana",
                "rules": [
                    {
                        "end": 1224997200000,
                        "start": 1205643600000
                    },
                    {
                        "end": 1256446800000,
                        "start": 1236488400000
                    },
                    {
                        "end": 1288501200000,
                        "start": 1268542800000
                    },
                    {
                        "end": 1321160400000,
                        "start": 1300597200000
                    },
                    {
                        "end": 1352005200000,
                        "start": 1333256400000
                    },
                    {
                        "end": 1383454800000,
                        "start": 1362891600000
                    },
                    {
                        "end": 1414904400000,
                        "start": 1394341200000
                    }
                ]
            },
            {
                "name": "America/Halifax",
                "rules": [
                    {
                        "end": 1225602000000,
                        "start": 1205042400000
                    },
                    {
                        "end": 1257051600000,
                        "start": 1236492000000
                    },
                    {
                        "end": 1289106000000,
                        "start": 1268546400000
                    },
                    {
                        "end": 1320555600000,
                        "start": 1299996000000
                    },
                    {
                        "end": 1352005200000,
                        "start": 1331445600000
                    },
                    {
                        "end": 1383454800000,
                        "start": 1362895200000
                    },
                    {
                        "end": 1414904400000,
                        "start": 1394344800000
                    }
                ]
            },
            {
                "name": "America/Goose_Bay",
                "rules": [
                    {
                        "end": 1225594860000,
                        "start": 1205035260000
                    },
                    {
                        "end": 1257044460000,
                        "start": 1236484860000
                    },
                    {
                        "end": 1289098860000,
                        "start": 1268539260000
                    },
                    {
                        "end": 1320555600000,
                        "start": 1299988860000
                    },
                    {
                        "end": 1352005200000,
                        "start": 1331445600000
                    },
                    {
                        "end": 1383454800000,
                        "start": 1362895200000
                    },
                    {
                        "end": 1414904400000,
                        "start": 1394344800000
                    }
                ]
            },
            {
                "name": "America/Godthab",
                "rules": [
                    {
                        "end": 1224982800000,
                        "start": 1206838800000
                    },
                    {
                        "end": 1256432400000,
                        "start": 1238288400000
                    },
                    {
                        "end": 1288486800000,
                        "start": 1269738000000
                    },
                    {
                        "end": 1319936400000,
                        "start": 1301187600000
                    },
                    {
                        "end": 1351386000000,
                        "start": 1332637200000
                    },
                    {
                        "end": 1382835600000,
                        "start": 1364691600000
                    },
                    {
                        "end": 1414285200000,
                        "start": 1396141200000
                    }
                ]
            },
            {
                "name": "America/Miquelon",
                "rules": [
                    {
                        "end": 1225598400000,
                        "start": 1205038800000
                    },
                    {
                        "end": 1257048000000,
                        "start": 1236488400000
                    },
                    {
                        "end": 1289102400000,
                        "start": 1268542800000
                    },
                    {
                        "end": 1320552000000,
                        "start": 1299992400000
                    },
                    {
                        "end": 1352001600000,
                        "start": 1331442000000
                    },
                    {
                        "end": 1383451200000,
                        "start": 1362891600000
                    },
                    {
                        "end": 1414900800000,
                        "start": 1394341200000
                    }
                ]
            },
            {
                "name": "Asia/Dubai",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Yerevan",
                "rules": [
                    {
                        "end": 1224972000000,
                        "start": 1206828000000
                    },
                    {
                        "end": 1256421600000,
                        "start": 1238277600000
                    },
                    {
                        "end": 1288476000000,
                        "start": 1269727200000
                    },
                    {
                        "end": 1319925600000,
                        "start": 1301176800000
                    },
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Jakarta",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Krasnoyarsk",
                "rules": [
                    {
                        "end": 1224961200000,
                        "start": 1206817200000
                    },
                    {
                        "end": 1256410800000,
                        "start": 1238266800000
                    },
                    {
                        "end": 1288465200000,
                        "start": 1269716400000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Shanghai",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Irkutsk",
                "rules": [
                    {
                        "end": 1224957600000,
                        "start": 1206813600000
                    },
                    {
                        "end": 1256407200000,
                        "start": 1238263200000
                    },
                    {
                        "end": 1288461600000,
                        "start": 1269712800000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Australia/Perth",
                "rules": [
                    {
                        "end": 1206813600000,
                        "start": 1224957600000
                    },
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Australia/Sydney",
                "rules": [
                    {
                        "end": 1207411200000,
                        "start": 1223136000000
                    },
                    {
                        "end": 1238860800000,
                        "start": 1254585600000
                    },
                    {
                        "end": 1270310400000,
                        "start": 1286035200000
                    },
                    {
                        "end": 1301760000000,
                        "start": 1317484800000
                    },
                    {
                        "end": 1333209600000,
                        "start": 1349539200000
                    },
                    {
                        "end": 1365264000000,
                        "start": 1380988800000
                    },
                    {
                        "end": 1396713600000,
                        "start": 1412438400000
                    }
                ]
            },
            {
                "name": "Australia/Lord_Howe",
                "rules": [
                    {
                        "end": 1207407600000,
                        "start": 1223134200000
                    },
                    {
                        "end": 1238857200000,
                        "start": 1254583800000
                    },
                    {
                        "end": 1270306800000,
                        "start": 1286033400000
                    },
                    {
                        "end": 1301756400000,
                        "start": 1317483000000
                    },
                    {
                        "end": 1333206000000,
                        "start": 1349537400000
                    },
                    {
                        "end": 1365260400000,
                        "start": 1380987000000
                    },
                    {
                        "end": 1396710000000,
                        "start": 1412436600000
                    }
                ]
            },
            {
                "name": "Asia/Tokyo",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Yakutsk",
                "rules": [
                    {
                        "end": 1224954000000,
                        "start": 1206810000000
                    },
                    {
                        "end": 1256403600000,
                        "start": 1238259600000
                    },
                    {
                        "end": 1288458000000,
                        "start": 1269709200000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Dhaka",
                "rules": [
                    false,
                    {
                        "end": 1262278800000,
                        "start": 1245430800000
                    },
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Omsk",
                "rules": [
                    {
                        "end": 1224964800000,
                        "start": 1206820800000
                    },
                    {
                        "end": 1256414400000,
                        "start": 1238270400000
                    },
                    {
                        "end": 1288468800000,
                        "start": 1269720000000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Australia/Brisbane",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Vladivostok",
                "rules": [
                    {
                        "end": 1224950400000,
                        "start": 1206806400000
                    },
                    {
                        "end": 1256400000000,
                        "start": 1238256000000
                    },
                    {
                        "end": 1288454400000,
                        "start": 1269705600000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Pacific/Noumea",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Pacific/Majuro",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Kamchatka",
                "rules": [
                    {
                        "end": 1224943200000,
                        "start": 1206799200000
                    },
                    {
                        "end": 1256392800000,
                        "start": 1238248800000
                    },
                    {
                        "end": 1288450800000,
                        "start": 1269698400000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Pacific/Tongatapu",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Pacific/Apia",
                "rules": [
                    false,
                    false,
                    false,
                    {
                        "end": 1301752800000,
                        "start": 1316872800000
                    },
                    {
                        "end": 1333202400000,
                        "start": 1348927200000
                    },
                    {
                        "end": 1365256800000,
                        "start": 1380376800000
                    },
                    {
                        "end": 1396706400000,
                        "start": 1411826400000
                    }
                ]
            },
            {
                "name": "Asia/Baghdad",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Europe/Minsk",
                "rules": [
                    {
                        "end": 1224979200000,
                        "start": 1206835200000
                    },
                    {
                        "end": 1256428800000,
                        "start": 1238284800000
                    },
                    {
                        "end": 1288483200000,
                        "start": 1269734400000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Europe/Moscow",
                "rules": [
                    {
                        "end": 1224975600000,
                        "start": 1206831600000
                    },
                    {
                        "end": 1256425200000,
                        "start": 1238281200000
                    },
                    {
                        "end": 1288479600000,
                        "start": 1269730800000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Karachi",
                "rules": [
                    {
                        "end": 1225476000000,
                        "start": 1212260400000
                    },
                    {
                        "end": 1257012000000,
                        "start": 1239735600000
                    },
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Asia/Yekaterinburg",
                "rules": [
                    {
                        "end": 1224968400000,
                        "start": 1206824400000
                    },
                    {
                        "end": 1256418000000,
                        "start": 1238274000000
                    },
                    {
                        "end": 1288472400000,
                        "start": 1269723600000
                    },
                    false,
                    false,
                    false,
                    false
                ]
            },
            {
                "name": "Africa/Johannesburg",
                "rules": [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false
                ]
            }
        ]
    };

    if (typeof exports !== 'undefined') {
        exports.jstz = jstz;
    } else {
        root.jstz = jstz;
    }
})(this);
