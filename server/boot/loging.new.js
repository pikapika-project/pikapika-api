const pogobuf = require('pogobuf');
const client = pogobuf.Client();

module.exports = function(app) {
  Trainer = app.models.trainer;

  app.post('/trainers/login/v2', function(req, res) {

    if (!req.body) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }

    var filter  = {
      where: {
        username: trainer.username,
        provider: trainer.provider.name
      }
    };

    Trainer.findOrCreate(filter, req.body, function(err, resTrainer, created) {
      if (err) {
        sendError(err, res);
      }

      var now = new Date();

      if (created) {
        resTrainer.createdAt = now;
        resTrainer.updatedAt = now;
      } else {
        resTrainer.updatedAt = now;
      }

      resTrainer.updateAttributes(resTrainer, function(err, instance) {
        if (err) {
          sendError(err, res);
        }
      });
    });

    res.json({
      data: {
        trainer: resTrainer
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
