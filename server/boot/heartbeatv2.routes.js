const pogobuf = require('pogobuf'),
  POGOProtos = require('node-pogo-protos');
GeoPoint = require('loopback').GeoPoint;
client = pogobuf.Client();
s2 = require('s2geometry-node');

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
        var currentUser = returnedInstance[0];

        client.setAuthInfo('google', currentUser.accessToken);
        client.setPosition(req.params.lat, req.params.lng);

        client.init()
          .then(() => {
            var pokemons = [];
            var stepSize = 0.0015;
            var stepLimit = 30;
            cell_ids = [];
            timestamps = [];
            var p, now;
            var coordsToScan = generateSpiral(lat, lng, stepSize, stepLimit);

            for (var i = 0; i < coordsToScan.length; i++) {
              lat = parseFloat(coordsToScan[i].lat);
              lng = parseFloat(coordsToScan[i].lng);
              cell_ids = get_cell_ids(lat, lng);
              timestamps = new Array(cell_ids.length + 1).join('0').split('').map(parseFloat);
              qs.push(client.getMapObjects(cell_ids, timestamps));
            }

            Promise.all(qs).then(response => {
              for (var i = 0; i < response.length; i++) {
                if (response[i] !== true) {
                  console.log(response[i]);
                  for (var a = 0; a < response[i].map_cells.length; a++) {
                    if (response[i].map_cells[a].wild_pokemons.length > 0) {
                      pokemons.push(response[i].map_cells[a].wild_pokemons);
                    }
                  }
                }
              }
              console.log(pokemons.length);
              res.json({data: pokemons});
            }).catch(err => {
              console.log(err);
            });
          });

      }
    });
  });

  function get_cell_ids(lat, lng) {
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
