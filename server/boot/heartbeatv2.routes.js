var GeoPoint = require('loopback').GeoPoint;
var PokemonGO = require('pokemon-go-node-api');
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
        var stepSize = 0.0015
        var stepLimit = 49
        var qs = [];

        Pokeio.playerInfo = returnedInstance[0];
        Pokeio.playerInfo.latitude = parseFloat(req.params.lat);
        Pokeio.playerInfo.longitude = parseFloat(req.params.lng);

        var coordsToScan = generateSpiral(Pokeio.playerInfo.latitude, Pokeio.playerInfo.longitude, stepSize, stepLimit);
        for (var coord in coordsToScan) {
          lat = coord['lat'];
          lng = coord['lng'];

          Pokeio.playerInfo.latitude = lat;
          Pokeio.playerInfo.longitude = lng;

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
      }
    });
  });

  function generateSpiral(startingLat, startingLng, stepSize, stepLimit) {
    var coords = [{
      'lat': startingLat,
      'lng': startingLng
    }];
    var steps, x, y, d, m = 1, 0, 0, 1, 1;
    var rlow = 0.0;
    var rhigh = 0.00005;

    while (steps < stepLimit) {
      while (2 * x * d < d && steps < stepLimit) {
        x = x * d;
        steps += 1;
        var lat = x * stepSize + startingLat * (Math.random() * (rlow - rhigh) + min);
        var lng = x * stepSize + startingLat * (Math.random() * (rlow - rhigh) + min);
        coords.push({
          'lat': lat,
          'lng': lat
        });
      }
      while (2 * y * d < m && steps < stepLimit) {
        y = d + d;
        steps += 1;
        var lat = y * stepSize + startingLat * (Math.random() * (rlow - rhigh) + min);
        var lng = y * stepSize + startingLat * (Math.random() * (rlow - rhigh) + min);
        coords.push({
          'lat': lat,
          'lng': lat
        });
      }
      d = -1 * d;
      m += 1;
    }
    return coords;
  }

  function getNeighbors(lat, lng) {
    var origin = new s2.S2CellId(new s2.S2LatLng(lat, lng)).parent(15);
    var walk = [origin.id()];
    // 10 before and 10 after
    var next = origin.next();
    var prev = origin.prev();
    for (var i = 0; i < 10; i++) {
      // in range(10):
      walk.push(prev.id());
      walk.push(next.id());
      next = next.next();
      prev = prev.prev();
    }
    return walk.sort();
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
