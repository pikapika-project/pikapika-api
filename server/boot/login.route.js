var PokemonGO = require('pokemon-go-node-api');

module.exports = function(app) {

  Trainer = app.models.trainer;

  app.post('/trainers/login', function(req, res) {

    if (!req.body || !req.body.device_unique_id || !req.body.provider) {
      res.status(404).json({
        error: {
          statusCode :    404,
          statusMessage : "Missing parameters."
        }
      });
    }

    var filter = {
      where: {
        _id: req.body.device_unique_id
      }
    }
    Trainer.findOne(filter, function(err, trainer) {
      var now = new Date();

      if (trainer) {
        trainer.id        = undefined;
        trainer.provider  = req.body.provider;
        trainer.updatedAt = now;

        trainer.updateAttributes(trainer);
      } else {
        trainer = {
          _id:       req.body.device_unique_id,
          provider:  req.body.provider,
          createdAt: now,
          updatedAt: now
        };

        Trainer.create(trainer);
      }

      res.json({
        data: {
          trainer: trainer
        }
      });
    });
  });

}
