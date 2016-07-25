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
    console.log('---------BODY---------');
    console.log(req.body);

    // Wanted body
    // {
    //   "username": "poketests42",
    //   "provider": {
    //     "name": "google",
    //     "token": "",
    //     "expireTime": ""
    //   },
    //   "location": {
    //     "latitude": 20.672233,
    //     "longitude": -103.368688,
    //     "altitude": 0
    //   }
    // }

    var trainer = req.body;
    var Pokeio = new PokemonGO.Pokeio();

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
        username: trainer.username,
        accessToken: Pokeio.playerInfo.accessToken,
        provider: trainer.provider.name,
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
          access_token: session.token,
          expire_time: session.expire_time
        }
      });
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
