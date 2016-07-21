var Pokeio = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/login', function(req, res) {

    if (req.body) {
      var location = req.location;
      console.log(location);
      var trainer = {
        username: req.username,
        password: req.password,
        location: {
          type: 'coords',
          name: location.name,
          coords: {
            latitude : location.coords.latitude,
            longitude: location.coords.longitude,
            altitude : location.coords.altitude
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
