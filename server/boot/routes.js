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

      var PokemonGO = require('pokemon-go-node-api');
      var Pokeio = new PokemonGO.Pokeio();
      var WildPokemons = [];

      function sendError(trainer, err, res) {
        var statusCode, statusMessage;

        if (trainer.provider === 'google') {
          if (err instanceof Error) {
            statusCode = err.statusCode || 400;
            statusMessage = err.message;
          } else {
            statusCode = err.response.statusCode || 400;
            statusMessage = err.response.statusMessage;
          }
        } else if (trainer.provider === 'ptc') {
          statusCode = 400;
          statusMessage = err.message;
        }

        res.status(statusCode).json({error: {statusCode: statusCode, statusMessage: statusMessage}});
      }

      Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err) {
        if (err) {
          sendError(trainer, err, res);
          return false;
        }
        Pokeio.Heartbeat(function(err, hb) {
          if (err) {
            sendError(trainer, err, res);
            return false;
          }

          hb.cells.forEach(function(cell) {
            if (cell.WildPokemon.length > 0) {
              WildPokemons = cell.WildPokemon;
              WildPokemons.forEach(function(wildPokemon, i) {
                wildPokemon.pokeinfo = Pokeio.pokemonlist[wildPokemon.pokemon.PokemonId - 1];
              });
            }
          });
          res.json({data: WildPokemons});
        });
      });
    }
  });
}
