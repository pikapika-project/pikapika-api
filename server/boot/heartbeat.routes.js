var GeoPoint = require('loopback').GeoPoint;
var PokemonGO = require('pokemon-go-node-api');
var Promise = require("bluebird");
const s2 = require('s2geometry-node');

module.exports = function(app) {

  app.get('/pokemons/:lat/:lng/heartbeat', function(req, res, next) {

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode:    404,
          statusMessage: "Missing parameters."
        }
      });
    }

    Trainer = app.models.trainer;
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
        var WildPokemons   = [];
        var NearbyPokemons = [];
        var MapPokemons    = [];
        var cells          = [];
        var Pokeio         = new PokemonGO.Pokeio();

        Pokeio.playerInfo           = returnedInstance[0];
        Pokeio.playerInfo.latitude  = parseFloat(req.params.lat);
        Pokeio.playerInfo.longitude = parseFloat(req.params.lng);

        var FirstHearbeat = Promise.promisify(Pokeio.Heartbeat);
        var Hearbeat      = Promise.promisify(Pokeio.Heartbeat);

        FirstHearbeat().then(hb => {
          var qs = [];

          for (var i = 0; i < hb.cells.length; i++) {
            var cellId   = new s2.S2CellId(hb.cells[i].S2CellId.toString());
            var thisCell = new s2.S2Cell(cellId);
            var latLng   = new s2.S2LatLng(thisCell.getCenter()).toString().split(',');

            cells.push({
              lat: latLng[0],
              lng: latLng[1]
            });
          }

          for (var a = 0; a < cells.length; a++) {
            Pokeio.playerInfo.latitude  = parseFloat(cells[a].lat);
            Pokeio.playerInfo.longitude = parseFloat(cells[a].lng);

            (function(arguments) {
              qs.push(Hearbeat());
            })();
          }

          Promise.all(qs)
            .then(function(resolves) {
              for (var i = 0; i < resolves.length; i++) {
                for (var a = 0; a < resolves[i].cells.length; a++) {
                  if (resolves[i].cells[a].WildPokemon.length > 0) {
                    for (var x = 0; x < resolves[i].cells[a].WildPokemon.length; x++) {
                      var wp = resolves[i].cells[a].WildPokemon[x];

                      var now = new Date();
                      WildPokemons.push({
                        id:        wp.SpawnPointId,
                        number:    wp.pokemon.PokemonId,
                        name:      Pokeio.pokemonlist[wp.pokemon.PokemonId - 1].name,
                        position:  new GeoPoint({lat: wp.Latitude, lng: wp.Longitude}),
                        timeleft:  wp.TimeTillHiddenMs,
                        createdAt: now,
                        expireAt:  new Date(now.getTime() + wp.TimeTillHiddenMs)
                      });
                    }
                  }
                }
              }

              app.models.pokemon.create(WildPokemons, function (err, obj) {
                res.json({
                  data:        WildPokemons,
                  data_length: WildPokemons.length
                });
              });
            });
        }).catch(err => {
          if (err) {
            sendError(err, res);
            return false;
          }
        });
      }
    });
  });

  function sendError(err, res) {
    var statusCode, statusMessage;

    if (err instanceof Error) {
      statusCode    = err.statusCode || 400;
      statusMessage = err.message;
    } else {
      statusCode    = err.response.statusCode || 400;
      statusMessage = err.response.statusMessage;
    }

    res.status(statusCode).json({
      error: {
        statusCode:    statusCode,
        statusMessage: statusMessage
      }
    });
  }

};
