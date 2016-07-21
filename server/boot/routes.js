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

      Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err) {
        if (err) throw err;

        Pokeio.Heartbeat(function(err, hb) {
          if (err) {
            console.log(err);
          }
          for (var i = hb.cells.length - 1; i >= 0; i--) {
            if (hb.cells[i].NearbyPokemon[0]) {
              var pokemon = Pokeio.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber) - 1]
              console.log('[+] There is a ' + pokemon.name + ' at ' + hb.cells[i].NearbyPokemon[0].DistanceMeters.toString() + ' meters')
            }
          }

        });

      });
    }
  });
}
