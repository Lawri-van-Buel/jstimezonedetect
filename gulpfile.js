var gulp = require('gulp');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var header = require('gulp-header');
var package = require('./package.json')

var buildTime = (function () {
    var now = new Date();
    var getMonth = function () {
        if (now.getMonth() < 10) {
            return "0" + now.getMonth();
        }
        return now.getMonth();
    };
    var getDate = function () {
        if (now.getDate() < 10) {
            return "0" + now.getDate();
        }

        return now.getDate();
    };

    return now.getFullYear() + "-" + getMonth() + "-" + getDate()
}());

var paths = {
    scripts: ['jstz.js']
};

gulp.task('build', [], function () {
    return gulp.src(paths.scripts)
	.pipe(jshint())
        .pipe(uglify())
        .pipe(concat('jstz.min.js'))
        .pipe(header('/*! jsTimezoneDetect - v' + package.version + ' - ' + buildTime + ' */\n'))
        .pipe(gulp.dest('.'))
});

gulp.task('watch', function () {
    gulp.watch(paths.scripts, ['build']);
});

gulp.task('default', ['watch', 'build']);
