var PokemonGO = require('pokemon-go-node-api');
const s2 = require('s2geometry-node');

module.exports = function(app) {
  app.get('/pokemons/:lat/:lng/all', function(req, res) {

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
    var filter = {
      where: {
        accessToken: req.query.access_token
      }
    };

    Trainer.find(filter, function(err, returnedInstance) {
      if (err) {
        sendError(err, res);
      }
      if (returnedInstance[0]) {
        var coords = {
          type: "coords",
          coords: {
            latitude: parseFloat(req.params.lat),
            longitude: parseFloat(req.params.lng),
            altitude: 0
          }
        };
        var WildPokemons = [];
        var cells = []
        var Pokeio = new PokemonGO.Pokeio();

        Pokeio.playerInfo = returnedInstance[0];
      }
    });
  });


  function sendError(err, res) {
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

};
