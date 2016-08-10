const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint;


module.exports = function(app) {

  Pokemon = app.models.pokemon;

  app.get('/v2/pokemons/:lat/:lng/:alt/heartbeat', getHeartbeat);

  function getHeartbeat(req, res, next) {

    if (!req.query.access_token || !req.params.lat || !req.params.lng || !req.params.alt) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
      return;
    }

    let client = pogobuf.Client();
    let pokemons = [];

    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let alt = parseFloat(req.params.alt);

    client.setAuthInfo('google', req.query.access_token);
    client.setPosition(lat, lng);
    client.init()
    .then(() => {
      var cellIDs = pogobuf.Utils.getCellIDs(lat, lng, 3);

      return bluebird
        .resolve(client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0)))
        .then(mapObjects => {
          return mapObjects.map_cells;
        })
        .each(cell => {
          return bluebird.resolve(cell.wild_pokemons)
            .each(pokemon => {

              if (!isExist(pokemons, pokemon)) {
                last_modified_timestamp_ms = pokemon.last_modified_timestamp_ms.toNumber();

                pokemons.push({
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
        res.json({error: err});
      });
  }


  /*
   * UTILS functions
   */
  function isExist(pokemons, pokemon) {
    return pokemons.some(function (p) {
      return p.id === pokemon.spawn_point_id;
    });
  }

};
