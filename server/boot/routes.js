var PokemonGO = require('pokemon-go-node-api');

var trainers = [];

module.exports = function(app) {

  app.post('/trainers/login', function(req, res) {

    if (!req.body) {
      res.status(404).json({error: {statusCode: 404, statusMessage: "Missing parameters."}});
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

    function sendError(trainer, err, res) {
      var statusCode, statusMessage;

      if (err instanceof Error) {
        statusCode = err.statusCode || 400;
        statusMessage = err.message;
      } else {
        statusCode = err.response.statusCode || 400;
        statusMessage = err.response.statusMessage;
      }

      res.status(statusCode).json({error: {statusCode: statusCode, statusMessage: statusMessage}});
    }

    Pokeio.init(trainer.username, trainer.password, trainer.location, trainer.provider, function(err, session) {
      if (err) {
        sendError(trainer, err, res);
        return false;
      }

      trainers[session.token] = Pokeio.playerInfo;
      var data = {accessToken: session.token, expire_time: session.expire_time};

      res.json({data: data});
    });
  });

  app.get('/pokemons/heartbeat', function(req, res) {

    if (!req.query.access_token) {
      res.status(404).json({error: {statusCode: 404, statusMessage: "Missing parameters."}});
    }

    var Pokeio = new PokemonGO.Pokeio();
    Pokeio.playerInfo = trainers[req.query.access_token];

    var WildPokemons = [];

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
