#!/usr/bin/env node
var fs = require('graceful-fs');
var program = require('commander');
var _ = require('underscore');
var md5 = require('md5');

var start = new Date();

program.version('1.0.0')
    .option('-e, --entries <n>', 'How Many Entries in a single file?', 10)
    .arguments('<cmd> <output> [dictionaryPath]')
    .action(function (cmd, output) {
        cmdValue = cmd;
        outputValue = output;
    });

program.parse(process.argv);

/**
 * File Reader
 * @param callback   Result Exported For Downstream Processing
 */
function readfile(callback) {
    fs.readFile(cmdValue, 'utf8', function (err, data) {
        if (err) {
            callback && callback(err);
        } else {
            var dir = './' + outputValue;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                fs.mkdirSync(dir + '/pages');
				fs.mkdirSync(dir + '/detail');
            }

            callback && callback(data);
        }
    });
}

/**
 * Upstream Result Parser
 * @param entry     Loaded JSON
 * @param callback  Output
 */
function parseFile(entry, callback) {
    if (JSON.parse(JSON.stringify(entry)).errno) {
        console.error(JSON.parse(JSON.stringify(entry)).code);
        process.exit(1);
    } else {
        var data = JSON.parse(entry);
        var result1 = _.map(data, function (RootVal, RootKey) {
            return _.map(RootVal, function (ChildVal, ChildKey) {
                var overcount = 0;
                return {
                    structure: ChildKey,
                    fname: ChildKey.replace(/[ ]/g, "_"),
                    hashname: md5(ChildKey.replace(/[ ]/g, "_")),
                    times: _.map(ChildVal, function (ChildVal1, ChildKey1) {
                        return overcount = overcount + ChildVal1.time;
                    })[0]
                }
            })[0]
        });
		var result2 = _.map(data, function (RootVal, RootKey) {
            return _.map(RootVal, function (ChildVal, ChildKey) {
				return {
					fname: md5(ChildKey.replace(/[ ]/g, "_")),
					examples: _.map(ChildVal, function (ChildVal1, ChildKey1) {
					return {
						sentence: ChildKey1.replace(/(o f)/g, "of").replace(/(o r)/g, "or").replace(/(i f)/g, "if"),
						path: ChildVal1.path.replace(/(OCR_PDF\/)/g, "").replace("tree/", "").replace(/[\/]/ig, ",").replace(".tree", "").replace(/[_]/ig, " "),
						time: ChildVal1.time
						}
                    })
				}
            })[0]
        });
        callback && callback(result1, result2);
    }
}

function writePages(entry, callback) {
    var jsonSrc = _.sortBy(entry, 'times').reverse();
    console.log('Number of Entries: ' + jsonSrc.length);
    console.log('It can be diced into: ' + Math.ceil(Number(jsonSrc.length) / Number(program.entries)) + ' Files');
    var first = 0;
    var last = Number(program.entries);
    var cnt = 1;
    var out = {};
    for (first; first + Number(program.entries) < jsonSrc.length;) {
        for (last; last < jsonSrc.length;
             last = last + Number(program.entries),
                 first = first + Number(program.entries), cnt++) {
            if (first == 0) {
                out = jsonSrc.slice(first, last);
            } else {
                out = jsonSrc.slice(first, last);
            }
            fs.writeFile('./' + outputValue + '/pages/' + cnt + '.json', JSON.stringify(out), 'utf8', null);
        }
        out = jsonSrc.slice(first, jsonSrc.length);
        fs.writeFile('./' + outputValue + '/pages/' + cnt + '.json', JSON.stringify(out), 'utf8', null);
    }
    callback && callback(cnt);
}
function writeFile(entry, callback) {
	var count = 0;
    _.each(entry, function (val) {
		count++;
		fs.writeFile('./' + outputValue + '/detail/' + val.fname + '.json', JSON.stringify(_.sortBy(val.examples, 'time').reverse()), 'utf8', null);
    });
	callback && callback(count);
}

readfile(function (callback) {
    parseFile(callback, function (result1, result2) {
		writePages(result1, function (meta) {
			var end = new Date() - start;
			var metadata = {
				pages: meta
			};
			fs.writeFile('./' + outputValue + '/metadata.json', JSON.stringify(metadata), 'utf8', null);
			console.log('Task Finished, %sms used for writing pages, %s file generated', end, meta);
		});
		writeFile(result2, function (callback) {
			var end = new Date() - start;
			console.log('Task Finished, %sms used for writing detail, %s file generated', end, callback);
		});
	})
});
