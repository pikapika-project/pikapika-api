var PokemonGO = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/trainers/login', function(req, res) {

    if (!req.body) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }

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

    var Pokeio = new PokemonGO.Pokeio();

    Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err, session) {
      if (err) {
        sendError(trainer, err, res);
        return false;
      }

      Trainer = app.models.trainer;

      var newTrainer = {
        username: trainer.username,
        accessToken: Pokeio.playerInfo.accessToken,
        latitude: trainer.location.coords.latitude,
        longitude: trainer.location.coords.longitude,
        provider: trainer.provider,
        apiEndpoint: Pokeio.playerInfo.apiEndpoint
      }

      Trainer.findOrCreate({
        where: {
          username: trainer.username,
          provider: trainer.provider
        }
      }, newTrainer, function(err, createdTrainer, created) {
        if (err) {
          sendError(trainer, err, res);
        }
        if (!created) {
          createdTrainer.updateAttributes(newTrainer, function(err, instance) {
            if (err) {
              sendError(trainer, err, res);
            }
          });
        }
      });

      var data = {
        access_token: session.token,
        expire_time: session.expire_time
      };

      res.json({
        data: data
      });
    });
  });

  app.get('/pokemons/:lat/:lng/heartbeat', function(req, res) {

    if (!req.query.access_token && !req.params.lat && !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }

    Trainer = app.models.trainer;

    var logedTrainer = [];

    Trainer.find({
      where: {
        accessToken: req.query.access_token
      }
    }, function(err, returnedInstance) {
      if (err) {
        sendError(trainer, err, res);
      }
      if (returnedInstance[0]) {
        var Pokeio = new PokemonGO.Pokeio();
        Pokeio.playerInfo = returnedInstance[0];
        Pokeio.SetLocation({
          type: "coords",
          coords: {
            latitude: parseFloat(req.params.lat),
            longitude: parseFloat(req.params.lng),
            altitude: 0
          }
        }, function(err, response) {
          if (err) {
            sendError(trainer, err, res);
            return false;
          }
          var WildPokemons = [];

          Pokeio.Heartbeat(function(err, hb) {
            if (err) {
              sendError(trainer, err, res);
              return false;
            }
            hb.cells.forEach(function(cell) {
              if (cell.WildPokemon.length > 0) {
                WildPokemons = cell.WildPokemon;

                WildPokemons.forEach(function(wp, i) {
                  wp.pokemon.PokemonName = Pokeio.pokemonlist[wp.pokemon.PokemonId - 1].name;
                });
              }
            });
            res.json({
              data: WildPokemons
            });
          });
        });
      }
    });
  });

  function sendError(trainer, err, res) {
    var statusCode, statusMessage;

    if (err instanceof Error) {
      statusCode = err.statusCode || 400;
      statusMessage = err.message;
    } else {
      statusCode = err.response.statusCode || 400;
      statusMessage = err.response.statusMessage;
    }

    res.status(statusCode).json({
      error: {
        statusCode: statusCode,
        statusMessage: statusMessage
      }
    });
  }

}
