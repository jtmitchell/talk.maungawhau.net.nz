'use strict';

// var _ = require('underscore');
var argv = require('yargs').argv;
var frontMatter = require('gulp-front-matter');
var merge = require('merge-stream');
var swig = require('swig');
var swigExtras = require('swig-extras');
var through = require('through2');
var rimraf = require('gulp-rimraf');
var marked = require('gulp-marked');
var gulp = require('gulp');
var path = require('path');
var rename = require('gulp-rename');
// var gutil = require('gulp-util');

var debug = require('gulp-debug');

var site = {
		'title': 'Maungawhau IT',
	    'url': 'http://talk.maungawhau.net.nz',
	    'urlRoot': '/',
	    'author': 'James Mitchell',
	    'email': 'james.mitchell@maungawhau.net.nz',
	    'twitter': 'saywibble',
	    'google_verify': 'ly8QgWAy0wwtyg5EoDAcuzhxRvsglDkNS740NVwHLco',
	    'analytics_id': 'UA-62644260-2',
	    'time': new Date()
};

if (argv._.indexOf('serve:dist') > -1) {
	site.url = 'http://localhost:9000';
}

swig.setDefaults({
    loader: swig.loaders.fs(__dirname + '/../app/assets/templates'),
    cache: false
});
swigExtras.useFilter(swig, 'truncate');

function summarize(marker) {
    return through.obj(function (file, enc, cb) {
        var summary = file.contents.toString().split(marker)[0];
        file.page.summary = summary;
        this.push(file);
        cb();
    });
}


function applyTemplate(templateFile) {
    var tpl = swig.compileFile(path.join(__dirname, '..', templateFile));

    return through.obj(function (file, enc, cb) {
        var data = {
            site: site,
            page: file.page,
            content: file.contents.toString()
        };
        file.contents = new Buffer(tpl(data), 'utf8');
        this.push(file);
        cb();
    });
}

gulp.task('cleanpresentations', function () {
    return gulp.src(['dist/presentations'], {read: false})
        .pipe(rimraf());
});

gulp.task('presentations', ['cleanpresentations'], function () {
    var images = gulp.src(['app/content/presentations/**/*.jpg','app/content/presentations/**/*.png'])
    		.pipe(gulp.dest('dist'));
    var extras = gulp.src([
						'app/content/presentations/**/*.pdf',
						'app/content/presentations/**/*.ipynb',
						'app/content/presentations/**/*.zip',
						'app/content/presentations/**/*.txt'])
    		.pipe(gulp.dest('dist'));
		var slides = gulp.src('app/content/presentations/**/*.slides')
				.pipe(frontMatter({property: 'page', remove: true}))
				.pipe(applyTemplate('app/assets/templates/slides.html'))
				.pipe(rename({extname: '.html'}))
				.pipe(gulp.dest('dist'));
    var presentations = gulp.src('app/content/presentations/**/*.md')
        .pipe(frontMatter({property: 'page', remove: true}))
        .pipe(marked())
        .pipe(summarize('<!--more-->'))
				.pipe(debug({minimal: false}))
        // Collect all the presentations and place them on the site object.
        .pipe((function () {
            var presentations = [];
            var tags = site.tags || [];
            return through.obj(function (file, enc, cb) {
                file.page.url = path.dirname(file.path.replace(file.base,'')) + '/' + path.basename(file.path, '.md');
                presentations.push(file.page);
                presentations[presentations.length - 1].content = file.contents.toString();

                if (file.page.tags) {
                    file.page.tags.forEach(function (tag) {
                        if (tags.indexOf(tag) === -1) {
                            tags.push(tag);
                        }
                    });
                }

                this.push(file);
                cb();
            },
            function (cb) {
                presentations.sort(function (a, b) {
                    return b.created - a.created;
                });
                site.presentations = presentations;
                site.tags = tags;
                cb();
            });
        })())
        .pipe(applyTemplate('app/assets/templates/presentation.html'))
        .pipe(gulp.dest('dist'));
    return merge(images, extras, slides, presentations);
});


gulp.task('cleanpages', function () {
    return gulp.src(['dist/*.html'], {read: false})
        .pipe(rimraf());
});


gulp.task('pages', ['cleanpages', 'presentations'], function () {
    var html = gulp.src(['app/content/pages/*.html'])
        .pipe(frontMatter({property: 'page', remove: true}))
        .pipe(through.obj(function (file, enc, cb) {
            var data = {
                site: site,
                page: {}
            };
            var tpl = swig.compileFile(file.path);
            file.contents = new Buffer(tpl(data), 'utf8');
            this.push(file);
            cb();
        }));

    var markdown = gulp.src('app/content/pages/*.md')
        .pipe(frontMatter({property: 'page', remove: true}))
        .pipe(marked())
        .pipe(applyTemplate('app/assets/templates/page.html'))
        .pipe(rename({extname: '.html'}));

    return merge(html, markdown)
        .pipe(gulp.dest('dist'));
});

gulp.task('rss', ['presentations'], function () {
    return gulp.src(['app/content/pages/rss.xml'])
        .pipe(through.obj(function (file, enc, cb) {
            var data = {
                site: site,
                page: {}
            };
            var tpl = swig.compileFile(file.path);
            file.contents = new Buffer(tpl(data), 'utf8');
            this.push(file);
            cb();
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('sitemap', ['presentations', 'pages'], function () {
    return gulp.src(['app/content/pages/sitemap.xml'])
        .pipe(through.obj(function (file, enc, cb) {
            var data = {
                site: site,
                page: {}
            };
            var tpl = swig.compileFile(file.path);
            file.contents = new Buffer(tpl(data), 'utf8');
            this.push(file);
            cb();
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('content', ['pages', 'rss', 'sitemap']);
