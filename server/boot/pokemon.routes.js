const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint,
    crypto     = require('crypto'),
    request    = require('request');

const proxies = [
  //'173.234.232.97:3128',
  '206.214.93.20:3128',
  //'173.234.232.80:3128',
  //'173.234.181.69:3128',
  '206.214.93.99:3128',
  '206.214.93.227:3128',
  '89.47.28.124:3128',
  '206.214.93.122:3128',
  //'173.234.181.114:3128',
  '89.47.28.198:3128'
];

module.exports = function(app) {

  Pokemon      = app.models.Pokemon;
  PokemonSpawn = app.models.PokemonSpawn;
  Gym          = app.models.Gym;

  app.get('/pokemons/:lat/:lng/heartbeat',         getHeartbeat); // Use heartbeat v2
  app.get('/v2/pokemons/:lat/:lng/:alt/heartbeat', getHeartbeat);
  app.get('/pokemons/:lat/:lng',                   getPokemon);

  function getHeartbeat(req, res, next) {

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res
        .status(404)
        .json({
          error: {
            statusCode:    404,
            statusMessage: "Missing parameters."
          }
        });

      return;
    }

    console.log("Heartbeat request from", req.headers['cf-ipcountry'], "(", req.headers['cf-connecting-ip'], ")");

    let pokemons = [];
    let gyms     = [];
    let lat      = Number(req.params.lat);
    let lng      = Number(req.params.lng);
    let alt      = 0;

    if (req.params.alt) {
      alt = Number(req.params.alt);
    }

    // ONLY FOR DEBUG
    // const account = new pogobuf.GoogleLogin();
    // account.login("pikapikatests42@gmail.com", "piripepiripe").then(token => {
    //   console.log(token);
    // });

    let client = pogobuf.Client();

    if (process.env.NODE_ENV === "production") {
      let proxy = proxies[getRandomInt(0, proxies.length)];

      client.setProxy(`http://${proxy}`)
    }
    client.setAuthInfo('google', req.query.access_token);
    client.setPosition(lat, lng);
    client.setAutomaticLongConversionEnabled(false);
    client
      .init()
      .then(() => {
        let cellIDs = pogobuf.Utils.getCellIDs(lat, lng, 3);

        return bluebird
          .resolve(client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0)))
          .then(mapObjects => {
            return mapObjects.map_cells;
          })
          .each(cell => {
            return bluebird
              .resolve(cell.wild_pokemons)
              .each(pokemon => {
                if (pokemon.time_till_hidden_ms < 0 || (pokemon.time_till_hidden_ms > 0 && pokemon.time_till_hidden_ms.toString().length < 7)) {
                  last_modified_timestamp_ms = pokemon.last_modified_timestamp_ms.toNumber();

                  // generate an id with encounter_id and spawn_point_id to be sure it's unique in the database
                  let genId = crypto.createHash('md5').update(pokemon.encounter_id.toString() + pokemon.spawn_point_id).digest("hex");
                  pokemons.push({
                    id:       genId,
                    number:   pokemon.pokemon_data.pokemon_id,
                    name:     pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, pokemon.pokemon_data.pokemon_id),
                    position: new GeoPoint({
                      lat: pokemon.latitude,
                      lng: pokemon.longitude
                    }),
                    timeleft:  pokemon.time_till_hidden_ms,
                    createdAt: new Date(last_modified_timestamp_ms),
                    expireAt:  (pokemon.time_till_hidden_ms > 0) ? new Date(last_modified_timestamp_ms + pokemon.time_till_hidden_ms) : null
                  });
                }
            });
          })
          .each(cell => {
            return bluebird
              .resolve(cell.forts)
              .each(fort => {
                // Only get gyms
                if (fort.type === 0 && fort.enabled === true) {
                  gyms.push({
                    id:       fort.id,
                    position: new GeoPoint({
                      lat: fort.latitude,
                      lng: fort.longitude
                    }),
                    ownedBy:   fort.owned_by_team,
                    createdAt: new Date(fort.last_modified_timestamp_ms.toNumber())
                  });
                }
              });
          });
        })
        .then((cells) => {
          res.json({
            data:        pokemons,
            data_length: pokemons.length
          });

          if (pokemons.length) {
            console.log("\t", pokemons.length, "pokemon scanned");

            saveToDatabase('pokemon', pokemons);
          }

          if (gyms.length) {
            console.log("\t", gyms.length, "gyms scanned");

            saveToDatabase('gym', gyms);
          }
        })
        .catch(err => {
          console.log(err);
          res.json({error: err});
        });
  }

  function getPokemon(req, res, next) {

    if (req.query.radius && req.query.radius > 50000) {
      res
        .status(400)
        .json({
          error: {
            statusCode:    400,
            statusMessage: "Bad request."
          }
        });

        return;
    }

    console.log("GET /pokemons request from", req.headers['cf-ipcountry'], "(", req.headers['cf-connecting-ip'], ")");

    let lat    = Number(req.params.lat);
    let lng    = Number(req.params.lng);
    let radius = Number(req.query.radius) || 2000;
    let swLat  = Number(req.query.swLat)  || lat - (Math.random() * 0.02);
    let swLng  = Number(req.query.swLng)  || lng - (Math.random() * 0.02);
    let neLat  = Number(req.query.neLat)  || lat + (Math.random() * 0.02);
    let neLng  = Number(req.query.neLng)  || lng + (Math.random() * 0.02);

    var radiusFilter = {
      where: {
        position: {
          near:        new GeoPoint({lat: lat, lng: lng}),
          maxDistance: radius
        }
      }
    };

    Pokemon.find(radiusFilter, function(err, pokemons) {
      if (!pokemons) {
        pokemons = [];
      }

      if (pokemons.length < ((12 * radius) / 1000)) {
        stealPokemon({lat: swLat, lng: swLng}, {lat: neLat, lng: neLng}, function (stolenPokemons) {
          pokemons = pokemons.concat(stolenPokemons);

          res.json({
            data:        pokemons,
            data_length: pokemons.length
          });

          if (stolenPokemons.length) {
            console.log("\t", stolenPokemons.length, "pokemon stolen");

            saveToDatabase('pokemon', stolenPokemons);
          }
        });
      } else {
        res.json({
          data:        pokemons,
          data_length: pokemons.length
        });
      }
    });
  }

  function stealPokemon(sw, ne, cb) {
    let pokemons = [];

    var opts = {
      url: `https://stop_fucking_with_us.goradar.io/raw_data?&swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}&pokemon=true&pokestops=false&gyms=false`
    };
    if (process.env.NODE_ENV === "production") {
      let proxy = proxies[getRandomInt(0, proxies.length)];

      opts.proxy = `http://${proxy}`;
    }
    request(opts, function (error, response, body) {
      if (error || response.statusCode !== 200 || !body) {
        cb(pokemons);
      }

      body = JSON.parse(body);

      for (var i = 0; i < body.pokemons.length; i++) {
        let pokemon  = body.pokemons[i];
        let genId    = crypto.createHash('md5').update(pokemon.encounter_id + pokemon.spawnpoint_id).digest("hex");
        let now      = new Date();
        let expireAt = new Date(pokemon.disappear_time);

        pokemons.push({
          id:       genId,
          number:   pokemon.pokemon_id,
          name:     pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, pokemon.pokemon_id),
          position: new GeoPoint({
            lat: pokemon.latitude,
            lng: pokemon.longitude
          }),
          timeleft:  expireAt.getTime() - now.getTime(),
          createdAt: now,
          expireAt:  expireAt
        });
      }

      cb(pokemons);
    });
  }

  function saveToDatabase(type, data) {
    let where;

    switch (type) {
      case 'pokemon':
        where = {
          _id: {
            inq: data.map(function(p) { return p.id; })
          }
        };

        Pokemon.destroyAll(where, function(err, info) {
          if (err) {
            console.log(err);
          }
          Pokemon.create(data, function (err, obj) {
            if (err) {
              console.log(err);
            }
          });
        });

        PokemonSpawn.destroyAll(where, function(err, info) {
          if (err) {
            console.log(err);
          }
          PokemonSpawn.create(data, function (err, obj) {
            if (err) {
              console.log(err);
            }
          });
        });
        break;
      case 'gym':
        where = {
          _id: {
            inq: data.map(function(g) { return g.id; })
          }
        };

        Gym.destroyAll(where, function(err, info) {
          if (err) {
            console.log(err);
          }
          Gym.create(data, function (err, obj) {
            if (err) {
              console.log(err);
            }
          });
        });
        break;
      default:
        console.warn("Not handled type in saveToDatabase()");
    }
  }

  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }
};
