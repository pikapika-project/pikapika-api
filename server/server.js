var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;


  if (process.env.NODE_ENV === "production") {
    if (cluster.isMaster) {
      // Fork workers.
      console.log("Creating", numCPUs, "workers...")
      for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Starting a new worker...`);
        cluster.fork();
      });
    } else {
      // start the server if `$ node server.js`
      if (require.main === module)
        app.start();
    }
  } else {
    // start the server if `$ node server.js`
    if (require.main === module)
      app.start();
  }
});
