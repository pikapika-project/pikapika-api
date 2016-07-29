const pogobuf = require('pogobuf');

let POGOProtos  = require('node-pogo-protos')
,   PokemonGO   = require('pokemon-go-node-api')
,   s2          = require('s2geometry-node')
,   Promise     = require('bluebird')
,   Pokeio      = new PokemonGO.Pokeio();

module.exports = function(app) {
  app.get('/v2/pokemons/:lat/:lng/heartbeat', function(req, res, next) {

    let client = pogobuf.Client();

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }

    let qs = [];
    let pokemons = [];
    let stepSize = 0.0015;
    let stepLimit = 30;
    let cell_ids = [];
    let timestamps = [];

    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let coordsToScan = generateSpiral(lat, lng, stepSize, stepLimit);

    client.setAuthInfo('google', req.query['access_token']);
    client.setPosition(lat, lng);
    client.init()
    .then(value => {
      for (let i = 0; i < coordsToScan.length; i++) {
        lat = parseFloat(coordsToScan[i].lat);
        lng = parseFloat(coordsToScan[i].lng);

        client.setPosition(lat, lng);

        cell_ids = get_cell_ids(lat, lng);
        timestamps = new Array(cell_ids.length + 1).join('0').split('').map(parseFloat);

        qs.push(
          client.getMapObjects(cell_ids, timestamps)
        );
      }
      Promise.all(qs).then(response => {
        let pokemon;
        for (let i = 0; i < response.length; i++) {
          if (response[i] !== true) {
            for (let a = 0; a < response[i].map_cells.length; a++) {
              for(let x = 0; x < response[i].map_cells[a].wild_pokemons.length; x++){
                pokemon = response[i].map_cells[a].wild_pokemons[x];

                if(!isExist(pokemons, pokemon)){
                  pokemon = {
                    id:       pokemon.spawn_point_id,
                    number:   pokemon.pokemon_data.pokemon_id,
                    name:     Pokeio.pokemonlist[pokemon.pokemon_data.pokemon_id - 1].name,
                    timeleft: pokemon.time_till_hidden_ms,
                    position: {
                      lat: pokemon.latitude,
                      lng: pokemon.longitude
                    }
                  };
                }

                pokemons.push(pokemon);
              }
            }
          }
        }
        res.json({data: pokemons});
      }).catch(err => {
        console.log(err);
      });
    })
    .catch(err => {
      console.log(err);
      res.status(423).json({error: err});
    });

  });

  function get_cell_ids(lat, lng) {
    let origin = new s2.S2CellId(new s2.S2LatLng(lat, lng)).parent(15);
    let walk = [origin.id()];
    // 10 before and 10 after
    let next = origin.next();
    let prev = origin.prev();
    for (let i = 0; i < 10; i++) {
      // in range(10):
      walk.push(prev.id());
      walk.push(next.id());
      next = next.next();
      prev = prev.prev();
    }
    return walk.sort();
  }

  function generateSpiral(startingLat, startingLng, stepSize, stepLimit) {
    let coords = [{
      'lat': startingLat,
      'lng': startingLng
    }];

    let steps = 1;
    let x = 0;
    let y = 0;
    let d = 1;
    let m = 1;
    let rlow = 0.0;
    let rhigh = 0.0005;

    while (steps < stepLimit) {
      while (2 * x * d < m && steps < stepLimit) {
        x = x + d;
        steps += 1;
        let random = (Math.random() * (rlow - rhigh) + rhigh).toFixed(4);
        let random2 = (Math.random() * (rlow - rhigh) + rhigh).toFixed(4);
        let lat = x * stepSize + startingLat + random;
        let lng = y * stepSize + startingLng + random2;

        coords.push({
          'lat': lat,
          'lng': lng
        });
      }

      while (2 * y * d < m && steps < stepLimit) {
        y = y + d;
        steps += 1;
        let lat = x * stepSize + startingLat + (Math.random() * (rlow - rhigh) + rlow);
        let lng = y * stepSize + startingLng + (Math.random() * (rlow - rhigh) + rlow);

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
    let statusCode, statusMessage;

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

  function isExist(pokemons, pokemon) {
    return pokemons.some(function (p) {
      return p.id === pokemon.spawn_point_id;
    });
  }

};
