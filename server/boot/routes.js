var Pokeio = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/login', function(req, res) {

    var location = req.body.location;
    if (req.body) {

      var trainer = {
        username: req.username,
        password: req.password,
        location: {
          type: 'coords',
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          altitude: location.altitude
        },
        provider: req.body.provider
      };

      Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err) {
        if (err) throw err;
      });
    }
  });
}
