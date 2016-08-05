module.exports = function(app) {

  app.get('/configuration', getConfiguration);

  function getConfiguration(req, res) {

    var config = {
      last_version: {
        ios: "1.0.0",
        android: "1.0.0"
      },
      ads: {
        reload_number: 5
      }
    };

    res.json({
      data: config
    });
  }

};
