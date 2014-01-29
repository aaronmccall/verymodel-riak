var _           = require('underscore'),
    async       = require('async'),
    ape         = require('ape'),
    fs          = require('fs'),
    path        = require('path'),
    docsPath    = path.join(__dirname, 'docs'),
    config      = require('./package.json'),
    footer      = _.template(fs.readFileSync(path.join(docsPath, 'readme.footer.md'), 'utf8'), config),
    header      = _.template(fs.readFileSync(path.join(docsPath, 'readme.header.md'), 'utf8'), config),
    docs        = _.compact(_.map(fs.readdirSync(docsPath), function (file) {
                    return path.extname(file) === '.js' ? path.join(docsPath, file) : false;
                })),
    md          = [];
console.log(config);
docs.push(path.join(__dirname, 'lib', 'defaults.js'));

async.each(docs, function (file, done) {
    var code = fs.readFileSync(file, 'utf8');
    ape.generate_doc(code, ape.get_language(file), 'md', null, function (err, markdown) {
        var name = path.basename(file, path.extname(file));
        name = name.substring(0,1).toUpperCase() + name.substring(1);
        markdown = "## " + name + '\n\n' + markdown;
        console.log(markdown.substring(0, 100));
        md.push(markdown.trim());
        done();
    });
}, function (err) {
    if (err) {
        console.error(err);
    }
    md.unshift(header.trim());
    md.push(footer.trim());
    fs.writeFileSync(__dirname + '/README.md', md.join('\n\n'));
});