'use strict';

const PORT = 1481,
    HOST = '0.0.0.0',
    express = require('express'),
    crypto = require('crypto'),
    execa = require('execa'),
    fs = require("fs"),
    app = express();

const logger = require('morgan');
const fetch = require('node-fetch');
const {withFile} = require('tmp-promise');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));

const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", (err) => {
            reject(err);
        });
        fileStream.on("finish", function () {
            resolve();
        });
    });
});

app.all('/', function (req, res, next) {
    function send(file) {
        res.sendFile(file, {
            headers: {
                'Content-Type': 'image/png'
            }
        });
    }

    const {q, bg, force} = req.query || {};

    if (!q) {
        return next(new Error('No URL specified'));
    }

    let hash = crypto.createHash('md5').update(req.originalUrl).digest("hex");
    const storageLocation = `/tmp/storage/${hash}`;

    // cached file
    if (!force && fs.existsSync(storageLocation)) {
        return send(storageLocation);
    }

    withFile(async ({path}) => {
            // when this function returns or throws - release the file
            await downloadFile(q, path);
            const {stdout} = await execa('rsvg-convert', ['-f', 'png', path, '-o', storageLocation, '-b', bg || 'None']);
            send(storageLocation);
        },
        {dir: '/tmp/downloads'}
    ).catch(e => next(e));

});

app.get('*', (req, res) => {
    res.send('svg2png proxy server');
});

app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        error: err.message
    });
});

app.listen(PORT, HOST);
console.info(`Running on http://${HOST}:${PORT}`);
