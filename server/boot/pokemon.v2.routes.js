const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint;


module.exports = function(app) {

  Pokemon = app.models.pokemon;

  app.get('/v3/pokemons/:lat/:lng/heartbeat', getHeartbeat);
  app.get('/v3/pokemons/:lat/:lng',           getPokemon);

  function getHeartbeat(req, res, next) {

    const google = new pogobuf.GoogleLogin();
    let client = pogobuf.Client();

    // if (!req.query.access_token || !req.params.lat || !req.params.lng) {
    //   res.status(404).json({
    //     error: {
    //       statusCode: 404,
    //       statusMessage: "Missing parameters."
    //     }
    //   });
    //   return;
    // }

    let pokemons = [];
    let now;

    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);

    //client.setAuthInfo('google', req.query.access_token);
    //client.setPosition(lat, lng);
    //client.init()
    google.login("poketests42@gmail.com", "piripepiripe").then(token => {
      client.setAuthInfo('google', token);
      client.setPosition(lat, lng);
      return client.init();
    })
    .then(() => {
      var cellIDs = pogobuf.Utils.getCellIDs(lat, lng, 8);

      return bluebird
        .resolve(client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0)))
        .then(mapObjects => {
          return mapObjects.map_cells;
        })
        .each(cell => {
          return bluebird.resolve(cell.wild_pokemons)
            .each(pokemon => {
              now = new Date();
              if (!isExist(pokemons, pokemon)) {
                pokemons.push({
                  id:       pokemon.spawn_point_id,
                  number:   pokemon.pokemon_data.pokemon_id,
                  name:     pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, pokemon.pokemon_data.pokemon_id),
                  position: new GeoPoint({
                    lat: pokemon.latitude,
                    lng: pokemon.longitude
                  }),
                  timeleft:  pokemon.time_till_hidden_ms,
                  createdAt: now,
                  expireAt:  new Date(now.getTime() + pokemon.time_till_hidden_ms)
                });
              }
          });
        });
      })
      .then(() => {
        Pokemon.create(pokemons, function(err, obj) {
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

    var radiusFilter = {
      where: {
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
