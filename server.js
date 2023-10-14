'use strict';

process.setMaxListeners(0);

const PORT = +process.env.PORT || 8888,
    HOST = process.env.HOST || '0.0.0.0',
    numCPUs = require('os').cpus().length,
    express = require('express'),
    app = express();

const logger = require('morgan');
const {Builder, Browser} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const {parse} = require('querystring');

const genericPool = require('generic-pool');

const BrowserFactory = {
    create: () => new Builder().forBrowser(Browser.CHROME)
        .setChromeOptions(new chrome.Options().headless())
        .build(),
    destroy: (client) => client.quit(),
};

const browserPool = genericPool.createPool(BrowserFactory, {
    max: +process.env.BROWSER_POOL_SIZE_MAX || numCPUs * 2,
    min: +process.env.BROWSER_POOL_SIZE_MIN || 1,
    softIdleTimeoutMillis: 30 * 1000, // idle objects to be removed after this timeout if pool size > min
    idleTimeoutMillis: 180 * 1000, // all idle objects to be removed after this timeout
    evictionRunIntervalMillis: 15 * 1000,
    //numTestsPerEvictionRun: 3 //default

});

browserPool.on('factoryCreateError', (err) => console.error('factoryCreateError', err))
    .on('factoryDestroyError', (err) => console.error('factoryDestroyError', err));

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
        driver = await browserPool.acquire();
        await driver.manage().window().setSize({width: +w, height: +h}); // resize window
        driver.get(q);
        const image = await driver.takeScreenshot();
        send(Buffer.from(image, 'base64'));
        await browserPool.release(driver);
    } catch (e) {
        driver && await browserPool.destroy(driver);
        return next(e);
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
