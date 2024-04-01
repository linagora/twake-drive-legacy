const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/internal',
    createProxyMiddleware({
      target: 'http://127.0.0.1:4000',
      onError: (err, req, resp) => {
        console.log(err);
      },
    }),
  );
  app.use(
    '/__',
    createProxyMiddleware({
      target: 'http://127.0.0.1:4000',
    }),
  );
};
