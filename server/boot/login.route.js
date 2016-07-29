var PokemonGO = require('pokemon-go-node-api');

module.exports = function(app) {

  app.post('/trainers/login', function(req, res) {

    console.log("[i] Login from " + req.headers['cf-ipcountry'] + " ("+ req.headers['x-forwarded-for'] + ")");

    if (!req.body) {
      res.status(404).json({
        error: {
          statusCode   : 404,
          statusMessage: "Missing parameters."
        }
      });
    }

    var trainer = req.body;
    var Pokeio  = new PokemonGO.Pokeio();

    Pokeio.init(trainer.username, trainer.location, trainer.provider, function(err, session) {
      if (err) {
        sendError(err, res);
        return false;
      }

      Trainer = app.models.trainer;
      var filter = {
        where: {
          username: trainer.username,
          provider: trainer.provider.name
        }
      };
      var newTrainer = {
        username   : trainer.username,
        accessToken: Pokeio.playerInfo.accessToken,
        provider   : trainer.provider.name,
        apiEndpoint: Pokeio.playerInfo.apiEndpoint
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
          expire_time : session.expireTime
        }
      });
    });
  });

  function sendError(err, res) {

    console.log(err);

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
