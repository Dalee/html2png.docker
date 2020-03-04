'use strict';

process.setMaxListeners(0);

const PORT = 1481,
    HOST = '0.0.0.0',
    express = require('express'),
    app = express();

const logger = require('morgan');
const {Builder, Capabilities} = require('selenium-webdriver');
const {parse} = require('querystring');

app.set('query parser', (qs, sep, eq, options) => {
    if (qs) {
        qs = qs.replace(/\+/g, '%2B'); // save plus symbol from decode
    }
    return parse(qs, sep, eq, options);
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false,
}));

app.all('/convert', async (req, res, next) => {
    function send(body) {
        res.contentType('image/png');
        res.send(body);
    }

    const {q, w = 640, h = 480} = req.query || {};

    if (!q) {
        return next(new Error('No URL specified'));
    }

    let driver;

    try {
        driver = await new Builder().withCapabilities(Capabilities.phantomjs()).build();
        driver.manage().window().setSize(w, h); // resize window
        driver.get(q);
        const image = await driver.takeScreenshot();
        send(Buffer.from(image, 'base64'));
    } catch (e) {
        next(e);
    } finally {
        driver && await driver.close();
    }

});

app.get('*', (req, res) => {
    res.send('html2png proxy server');
});

app.use((err, req, res/*, next*/) => {
    res.status(err.status || 500);
    res.json({
        error: err.message
    });
});

app.listen(PORT, HOST);
console.info(`Running on http://${HOST}:${PORT}`);
