const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint,
    crypto     = require('crypto');

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
    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let alt = 0;

    if (req.params.alt) {
      alt = parseFloat(req.params.alt);
    }

    // ONLY FOR DEBUG
    // const account = new pogobuf.GoogleLogin();
    // account.login("pikapikatests42@gmail.com", "piripepiripe").then(token => {
    //   console.log(token);
    // });

    let client = pogobuf.Client();

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
            let where = {
              _id: {
                inq: pokemons.map(function(p) { return p.id; })
              }
            };

            Pokemon.destroyAll(where, function(err, info) {
              if (err) {
                console.log(err);
              }
              Pokemon.create(pokemons, function (err, obj) {
                if (err) {
                  console.log(err);
                }
              });
            });

            PokemonSpawn.destroyAll(where, function(err, info) {
              if (err) {
                console.log(err);
              }
              PokemonSpawn.create(pokemons, function (err, obj) {
                if (err) {
                  console.log(err);
                }
              });
            });
          }

          /*if (gyms.length) {
            let where = {
              _id: {
                inq: gyms.map(function(g) { return g.id; })
              }
            };

            Gym.destroyAll(where, function(err, info) {
              if (err) {
                console.log(err);
              }
              Gym.create(gyms, function (err, obj) {
                if (err) {
                  console.log(err);
                }
              });
            });
          }*/
        })
        .catch(err => {
          console.log(err);
          res.json({error: err});
        });
  }

  function getPokemon(req, res, next) {

    if (!req.params.lat || !req.params.lng) {
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
      if (!nearbyPokemon) {
        nearbyPokemon = [];
      }

      res.json({
        data:        nearbyPokemon,
        data_length: nearbyPokemon.length
      });
    });
  }


};
