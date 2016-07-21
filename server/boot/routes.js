var Pokeio = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/login', function(req, res) {

    if (req.body) {
      var trainer = {
        username: req.body.username,
        password: req.body.password,
        location: {
          type: 'coords',
          name: req.body.location.name,
          coords: {
            latitude: req.body.location.coords.latitude,
            longitude: req.body.location.coords.longitude,
            altitude: req.body.location.coords.altitude
          }
        },
        provider: req.body.provider
      };

      var Pokeio = require('pokemon-go-node-api');
      var NearbyPokemons = [];

      Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err) {
        if (err) throw err;

        Pokeio.Heartbeat(function(err, hb) {
          if (err) {
            console.log(err);
          }
          hb.cells.forEach(function(cell) {
            if (cell.WildPokemon.length > 0) {
              NearbyPokemons.push(cell.WildPokemon);
            }
          });

          res.json({NearbyPokemons});
        });
      });
    }
  });
}
