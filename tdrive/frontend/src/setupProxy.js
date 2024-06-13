const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  [
    '/internal',
    '/plugins',
  ].forEach(urlPrefix => {
    app.use(
      urlPrefix,
      createProxyMiddleware({
        target: 'http://127.0.0.1:4000',
        onError: (err, req, resp) => {
          console.log(err);
        },
      }),
    );
  });
};
