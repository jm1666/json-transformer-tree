#!/usr/bin/env node
var async = require('async');
var program = require('commander');
var fs = require('graceful-fs');
var md5 = require('md5');
var _ = require('underscore');


var start = new Date();
var cmdValue = [];
var outputValue = "";

program.version('1.0.0')
    .option('-e, --entries <n>', 'How Many Entries in a single file?', 10)
    .arguments('<cmd1> <cmd2> <output> [dictionaryPath]')
    .action(function (cmd1, cmd2, output) {
        cmdValue[0] = cmd1;
        cmdValue[1] = cmd2;
        outputValue = output;
    });

program.parse(process.argv);

function readAsync(file, callback) {
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) throw err;
        callback(null, data);
    });
}

function parseFile(rFEntry, callback) {
    var data = JSON.parse(rFEntry[0]);
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
    callback(null, result2, rFEntry[1]);
}

function parseStructure(pfResult2, rFEntry1, callback) {
    var data = JSON.parse(rFEntry1);
    var result = [];
    data.forEach(function (item) {
        var content = [];
        item.forEach(function (item) {
            content.push({
                name: item,
                hashname: md5(item.replace(/[ ]/g, "_"))
            })
        });
        result.push({
            name: item[0],
            hashname: md5(item[0].replace(/[ ]/g, "_")),
            contents: content
        });
    });
    callback(null, pfResult2, result);
}

function writeFile(pfResult2, pSResult, callback) {
    var count = 0;
    _.each(pfResult2, function (val) {
        count++;
        fs.writeFile('./' + outputValue + '/detail/' + val.fname + '.json', JSON.stringify(_.sortBy(val.examples, 'time').reverse()), 'utf8', null);
    });
    callback(null, pSResult, count);
}

function writeGroup(pSResult, wFResult, callback) {
    console.log('Number of Entries: ' + pSResult.length);
    console.log('It can be diced into: ' + Math.ceil(Number(pSResult.length) / Number(program.entries)) + ' Files');
    var first = 0;
    var last = Number(program.entries);
    var cnt = 1;
    var out = {};
    for (first; first + Number(program.entries) < pSResult.length;) {
        for (last; last < pSResult.length;
             last = last + Number(program.entries),
                 first = first + Number(program.entries), cnt++) {
            if (first == 0) {
                out = pSResult.slice(first, last);
            } else {
                out = pSResult.slice(first, last);
            }
            fs.writeFile('./' + outputValue + '/pages/' + cnt + '.json', JSON.stringify(out), 'utf8', null);
        }
        out = pSResult.slice(first, pSResult.length);
        fs.writeFile('./' + outputValue + '/pages/' + cnt + '.json', JSON.stringify(out), 'utf8', null);
    }
    callback(null, [wFResult, cnt]);
}

async.map(cmdValue, readAsync, function (err, results) {
    async.waterfall([
        async.apply(parseFile, results),
        parseStructure,
        writeFile,
        writeGroup
    ], function (err, result) {
        var end = new Date() - start;
        var metadata = {
            pages: result[0]
        };
        fs.writeFile('./' + outputValue + '/metadata.json', JSON.stringify(metadata), 'utf8', null);
        console.log('Task Finished, %sms used for writing Grouped Pages, %s file generated', end, result[0]);
        end = new Date() - start;
        console.log('Task Finished, %sms used for writing detail, %s file generated', end, result[1]);
    });
});
