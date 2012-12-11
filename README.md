## Introduction

This is a small unintrusive JavaScript library that helps with detecting the [IANA zone info key][1] representing the time zone of a browser client.

The IANA timezone database is pretty much standard for most platforms (UNIX and Mac support it natively, and every programming language in the world either has native support or well maintained libraries that support it).

## Example Use

There is a [minified version in the repo][3] called `jstz.min.js`. Include it in your HTML document.

Invoke the script by calling

    :::javascript
        var tz = jstz.determine(); // Determines the time zone of the browser client
        tz.name(); // Returns the name of the resulting time zone

## Use Case

The script is useful if you do not want to disturb your user's with questions about what time zone they are in. You can rely on this script to give you a key that is usable for server side date time normalisations across time zones. 

## Limitations

This script does not do geo-location. So if you are unhappy with the time zone "Europe/Berlin" when the user is in fact in "Europe/Stockholm" - this script is not for you. Europe/Berlin and Europe/Stockholm are for nearly all scenarios completely identical, they both represent Central European Time.

## Demo

There is an updated demo running on: [http://pellepim.bitbucket.org/jstz/][2].

## Contribute?

If you want to contribute to the project (perhaps fix a bug, or reflect a change in time zone rules), please simply issue a Pull Request. Don't worry about [Grunt][4] builds etc, all you need to modify is the jstz.js file and I'll take care of the testing/minifying etc.

[1]: http://www.iana.org/time-zones
[2]: http://pellepim.bitbucket.org/jstz/
[3]: https://bitbucket.org/pellepim/jstimezonedetect/src
[4]: https://github.com/gruntjs/grunt