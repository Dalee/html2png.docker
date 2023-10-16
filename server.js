'use strict';

process.setMaxListeners(0);

const PORT = +process.env.PORT || 8888,
    HOST = process.env.HOST || '0.0.0.0',
    MAX_QUERY_TIMEOUT = +process.env.MAX_QUERY_TIMEOUT || 0,
    numCPUs = require('os').cpus().length,
    BROWSER_POOL_SIZE_MAX = +process.env.BROWSER_POOL_SIZE_MAX || numCPUs * 2,
    BROWSER_POOL_SIZE_MIN = +process.env.BROWSER_POOL_SIZE_MIN || 0,
    express = require('express'),
    app = express();

const logger = require('morgan');
const {Builder, Browser} = require('selenium-webdriver');
const {Options} = require('selenium-webdriver/chrome');
const {parse} = require('querystring');

const genericPool = require('generic-pool');

const BrowserFactory = {
    create: () => new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(new Options().addArguments('--headless=new', '--hide-scrollbars'))
        .build(),
    destroy: (client) => client.quit(),
};

const browserPool = genericPool.createPool(BrowserFactory, {
    max: BROWSER_POOL_SIZE_MAX,
    min: BROWSER_POOL_SIZE_MIN,
    softIdleTimeoutMillis: 60 * 1000, // idle objects to be removed after this timeout if pool size > min
    idleTimeoutMillis: 120 * 1000, // all idle objects to be removed after this timeout
    evictionRunIntervalMillis: 10 * 1000,
    acquireTimeoutMillis: 10 * 1000,
    destroyTimeoutMillis: 1000,
    //numTestsPerEvictionRun: 3 //default

});

browserPool
    .on('factoryCreateError', (err) => console.error('factoryCreateError', err))
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
    const {q, w = 640, h = 480} = req.query || {};

    if (!q) {
        return next(new Error('No URL specified'));
    }

    let driver;

    try {
        driver = await browserPool.acquire();
        await driver.manage().window().setSize({width: +w, height: +h}); // resize window
        if (MAX_QUERY_TIMEOUT > 0) {
            await driver.manage().setTimeouts({pageLoad: MAX_QUERY_TIMEOUT}); // Page load timeout
        }
        await driver.get(q);
        const image = await driver.takeScreenshot();

        res.contentType('image/png');
        res.send(Buffer.from(image, 'base64'));

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

const server = app.listen(PORT, HOST);
console.info(`Running on http://${HOST}:${PORT}`);

process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received: closing HTTP server');
    await browserPool.drain();
    await browserPool.clear();
    server.close(() => {
        console.info('HTTP server closed')
    })
})
