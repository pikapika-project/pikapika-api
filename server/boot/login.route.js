var PokemonGO = require('pokemon-go-node-api');
var Promise = require("bluebird");

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

    var trainer = req.body;
    var Pokeio = new PokemonGO.Pokeio();
    var PokemonGoInit = Promise.promisify(Pokeio.init);
    Trainer = app.models.trainer;

    PokemonGoInit().then(session => {

      var filter = {
        where: {
          username: trainer.username,
          provider: trainer.provider.name
        }
      };

      var newTrainer = {
        username: trainer.username,
        accessToken: session.accessToken,
        provider: trainer.provider.name,
        apiEndpoint: session.apiEndpoint
      }

      Trainer.findOrCreate(filter, newTrainer, function(err, createdTrainer, created) {
        if (err) {
          sendError(err, res);
        }

        if (!created) {
          createdTrainer.updateAttributes(newTrainer, function(err, instance) {
            if (err) {
              sendError(err, res);
            }
          });
        }
      });

      res.json({
        data: {
          access_token: session.accessToken,
          expire_time: session.tokenExpireTime
        }
      });

    }).catch(err => {
      if (err) {
        sendError(err, res);
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

}
