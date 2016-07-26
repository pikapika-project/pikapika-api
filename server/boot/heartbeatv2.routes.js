var GeoPoint = require('loopback').GeoPoint;
var PokemonGO = require('pokemon-go-node-api');
var _ = require('underscore');
var Promise = require("bluebird");
const s2 = require('s2geometry-node');

module.exports = function(app) {

  app.get('/pokemons/:lat/:lng/heartbeat/v2', function(req, res, next) {

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
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
        var WildPokemons = [];
        var NearbyPokemons = [];
        var MapPokemons = [];
        var cells = [];

        var Pokeio = new PokemonGO.Pokeio();
        var stepSize = 0.0015;
        var stepLimit = 49;
        var qs = [];

        Pokeio.playerInfo = returnedInstance[0];
        Pokeio.playerInfo.latitude = parseFloat(req.params.lat);
        Pokeio.playerInfo.longitude = parseFloat(req.params.lng);

        var FirstHearbeat = Promise.promisify(Pokeio.Heartbeat);
        var Hearbeat = Promise.promisify(Pokeio.Heartbeat);

        FirstHearbeat().then(hb => {

          var coordsToScan = generateSpiral(Pokeio.playerInfo.latitude, Pokeio.playerInfo.longitude, stepSize, stepLimit);

          for (var i = 0; i < coordsToScan.length; i++) {
            Pokeio.playerInfo.latitude = parseFloat(coordsToScan[i].lat);
            Pokeio.playerInfo.longitude = parseFloat(coordsToScan[i].lng);

            (function(arguments) {
              qs.push(Hearbeat());
            })();
          }
          var wp;
          var now;
          var prev;
          Promise.all(qs)
            .then(function(resolves) {
              for (var i = 0; i < resolves.length; i++) {
                for (var a = 0; a < resolves[i].cells.length; a++) {
                  if (resolves[i].cells[a].WildPokemon.length > 0) {
                    for (var x = 0; x < resolves[i].cells[a].WildPokemon.length; x++) {
                      wp = resolves[i].cells[a].WildPokemon[x];
                      if (checkIfExist(WildPokemons, wp) === false) {
                        now = new Date();
                        WildPokemons.push({
                          id: wp.SpawnPointId,
                          number: wp.pokemon.PokemonId,
                          name: Pokeio.pokemonlist[wp.pokemon.PokemonId - 1].name,
                          position: new GeoPoint({
                            lat: wp.Latitude,
                            lng: wp.Longitude
                          }),
                          timeleft: wp.TimeTillHiddenMs,
                          createdAt: now,
                          expireAt: new Date(now.getTime() + wp.TimeTillHiddenMs)
                        });
                      }
                    }
                  }
                }
              }
              app.models.pokemon.create(WildPokemons, function(err, obj) {
                res.json({
                  data: WildPokemons,
                  data_length: WildPokemons.length
                });
              });
            }).catch(err => {
              if (err) {
                sendError(err, res);
                return false;
              }
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

  function checkIfExist(array, newObject) {
    if (array.length === 0) {
      return false
    }
    for (var i = 0; i < array.length; i++) {
      if (array[i].position.lat == newObject.Latitude && array[i].position.lng == newObject.Longitude) {
        return true;
      }
    }
    return false;
  }

  function generateSpiral(startingLat, startingLng, stepSize, stepLimit) {
    var coords = [{
      'lat': startingLat,
      'lng': startingLng
    }];

    var steps = 1;
    var x = 0;
    var y = 0;
    var d = 1;
    var m = 1;
    var rlow = 0.0;
    var rhigh = 0.0005;

    while (steps < stepLimit) {
      while (2 * x * d < m && steps < stepLimit) {
        x = x + d;
        steps += 1;
        var random = (Math.random() * (rlow - rhigh) + rhigh).toFixed(4);
        var random2 = (Math.random() * (rlow - rhigh) + rhigh).toFixed(4);
        var lat = x * stepSize + startingLat + random;
        var lng = y * stepSize + startingLng + random2;
        coords.push({
          'lat': lat,
          'lng': lng
        });
      }
      while (2 * y * d < m && steps < stepLimit) {
        y = y + d;
        steps += 1;
        var lat = x * stepSize + startingLat + (Math.random() * (rlow - rhigh) + rlow);
        var lng = y * stepSize + startingLng + (Math.random() * (rlow - rhigh) + rlow);
        coords.push({
          'lat': lat,
          'lng': lng
        });
      }
      d = -1 * d;
      m = m + 1;
    }
    return coords;
  }

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
