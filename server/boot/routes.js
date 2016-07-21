var Pokeio = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/login', function(req, res) {

    if (req.body) {

      var trainer = {
        username: req.username,
        password: req.password,
        location: {
          type  : 'coords',
          name  : req.location.name,
          coords: {
            latitude : req.location.coords.latitude,
            longitude: req.location.coords.longitude,
            altitude : req.location.coords.altitude
          }
        },
        provider: req.body.provider
      };

      Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err) {
        if (err) throw err;
      });
    }
  });
}
