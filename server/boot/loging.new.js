const pogobuf = require('pogobuf'),
  POGOProtos = require('node-pogo-protos');

const client = pogobuf.Client();

module.exports = function(app) {

  app.post('/trainers/login/v2', function(req, res) {

    if (!req.body) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }
    var now;
    var trainer = req.body;

    var filter = {
      where: {
        username: trainer.username,
        provider: trainer.provider.name
      }
    };

    Trainer = app.models.trainer;

    var newTrainer = {
      username: trainer.username,
      accessToken: trainer.accessToken,
      provider: trainer.provider.name,
    }

    Trainer.findOrCreate(filter, newTrainer, function(err, createdTrainer, created) {
      if (err) {
        sendError(err, res);
      }

      now = new Date();

      if (created) {
        newTrainer.createdAt = now;
        newTrainer.updatedAt = now;
      } else {
        newTrainer.updatedAt = now;
      }

      createdTrainer.updateAttributes(newTrainer, function(err, instance) {
        if (err) {
          sendError(err, res);
        }
      });
    });

    res.json({
      data: {
        access_token: trainer.accessToken,
        expire_time: trainer.tokenExpireTime
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
