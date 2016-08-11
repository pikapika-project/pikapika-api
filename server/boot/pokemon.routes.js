const pogobuf = require('pogobuf');

let PokemonGO   = require('pokemon-go-node-api')
,   Promise     = require('bluebird')
,   s2          = require('s2geometry-node')
,   Pokeio      = new PokemonGO.Pokeio()
,   GeoPoint    = require('loopback').GeoPoint;

module.exports = function(app) {

  Pokemon = app.models.pokemon;

  app.get('/pokemons/:lat/:lng/heartbeat', getHeartbeat);
  app.get('/pokemons/:lat/:lng',           getPokemon);

  function getHeartbeat(req, res, next) {

    let client = pogobuf.Client();

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
      return;
    }

    console.log("Using old heartbeat function")

    let qs = [];
    let pokemons = [];
    let stepSize = 0.0015;
    let stepLimit = 30;
    let cell_ids = [];
    let timestamps = [];

    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let coordsToScan = generateSpiral(lat, lng, stepSize, stepLimit);

    client.setAuthInfo('google', req.query.access_token);
    client.setPosition(lat, lng);
    client.init()
      .then(value => {
        for (let i = 0; i < coordsToScan.length; i++) {
          lat = parseFloat(coordsToScan[i].lat);
          lng = parseFloat(coordsToScan[i].lng);

          client.setPosition(lat, lng);

          cell_ids   = get_cell_ids(lat, lng);
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
                for (let x = 0; x < response[i].map_cells[a].wild_pokemons.length; x++) {
                  pokemon = response[i].map_cells[a].wild_pokemons[x];

                  if (!isExist(pokemons, pokemon)) {
                    last_modified_timestamp_ms = pokemon.last_modified_timestamp_ms.toNumber();

                    pokemons.push({
                      id:       pokemon.encounter_id.toString(),
                      number:   pokemon.pokemon_data.pokemon_id,
                      name:     Pokeio.pokemonlist[pokemon.pokemon_data.pokemon_id - 1].name,
                      position: new GeoPoint({
                        lat: pokemon.latitude,
                        lng: pokemon.longitude
                      }),
                      timeleft:  pokemon.time_till_hidden_ms,
                      createdAt: new Date(last_modified_timestamp_ms),
                      expireAt:  (pokemon.time_till_hidden_ms > 0) ? new Date(last_modified_timestamp_ms + pokemon.time_till_hidden_ms) : null
                    });
                  }
                }
              }
            }
          }

          for (let i = 0; i < pokemons.length; i++) {
            Pokemon.upsert(pokemons[i]);
          }

          res.json({
            data:        pokemons,
            data_length: pokemons.length
          });
        });
      })
      .catch(err => {
        console.log(err);
        res.status(429).json({error: err});
      });
  }

  function getPokemon(req, res, next) {

    if (!req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
      return;
    }

    if (req.query.radius && req.query.radius > 50000) {
      res.status(400).json({
        error: {
          statusCode: 400,
          statusMessage: "Bad request."
        }
      });
      return;
    }

    var radiusFilter = {
      where: {
        expireAt: {
          gt: new Date().toISOString()
        },
        position: {
          near:        new GeoPoint({lat: req.params.lat , lng: req.params.lng}),
          maxDistance: req.query.radius || 2000,
          unit:        'meters'
        }
      }
    }

    Pokemon.find(radiusFilter, function(err, nearbyPokemon) {
      res.json({
        data:        nearbyPokemon,
        data_length: nearbyPokemon.length
      });
    });
  }


  /*
   * UTILS functions
   */
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

  function isExist(pokemons, pokemon) {
    return pokemons.some(function (p) {
      return p.id === pokemon.spawn_point_id;
    });
  }

};
