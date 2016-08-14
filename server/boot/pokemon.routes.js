const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint;

module.exports = function(app) {

  Pokemon = app.models.pokemon;

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
    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let alt = 0;

    if (req.params.alt) {
      alt = parseFloat(req.params.alt);
    }

    let client = pogobuf.Client();

    client.setAuthInfo('google', req.query.access_token);
    client.setPosition(lat, lng);
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
                if (pokemon.time_till_hidden_ms < 0 || (pokemon.time_till_hidden_ms > 0 && pokemon.time_till_hidden_ms.length < 7)) {
                  last_modified_timestamp_ms = pokemon.last_modified_timestamp_ms.toNumber();

                  let p = {
                    id:       pokemon.encounter_id.toString(),
                    number:   pokemon.pokemon_data.pokemon_id,
                    name:     pogobuf.Utils.getEnumKeyByValue(POGOProtos.Enums.PokemonId, pokemon.pokemon_data.pokemon_id),
                    position: new GeoPoint({
                      lat: pokemon.latitude,
                      lng: pokemon.longitude
                    }),
                    timeleft:  pokemon.time_till_hidden_ms,
                    createdAt: new Date(last_modified_timestamp_ms),
                    expireAt:  (pokemon.time_till_hidden_ms > 0) ? new Date(last_modified_timestamp_ms + pokemon.time_till_hidden_ms) : null
                  };

                  pokemons.push(p);
                  Pokemon.upsert(p);
                }
            });
          });
        })
        .then(() => {
          res.json({
            data:        pokemons,
            data_length: pokemons.length
          });
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

    var radiusFilter = {
      where: {
        expireAt: {
          gt:          new Date().toISOString()
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


};
