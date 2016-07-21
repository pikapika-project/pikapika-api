var Pokeio = require('pokemon-go-node-api');

module.exports = function(app) {
  var router = app.loopback.Router();

  router.post('/login', function(req, res) {
    console.log(req);
    var trainer = {
      username: req.username,
      password: req.password,
      location: {
        type: req.location.type || 'coords',
        name: req.location.name,
        latitude: req.location.latitude,
        longitude: req.location.longitude,
        altitude:  req.location.altitude
      },
      provider: req.provider
    };

    var pokemongapi = Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function (err) {
      if(err) throw err;
    });

  });

  app.use(router);
}
