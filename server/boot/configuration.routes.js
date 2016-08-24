module.exports = function(app) {

  app.get('/configuration', getConfiguration);

  function getConfiguration(req, res) {

    var config = {
      last_version: {
        ios: "1.0.0",
        android: "1.0.2"
      },
      ads: {
        reload_number: 5
      },
      apk_url: "https://pikapika.io/pikapika-v120.apk"
    };

    res.json({
      data: config
    });
  }

};
