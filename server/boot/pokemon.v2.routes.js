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

    const google = new pogobuf.GoogleLogin();
    let client = pogobuf.Client();

    let pokemons = [];
    let now;

    let lat = parseFloat(req.params.lat);
    let lng = parseFloat(req.params.lng);
    let alt = parseFloat(req.params.alt);

    client.setAuthInfo('google', req.query.access_token);
    client.setPosition(lat, lng);
    client.init()
    .then(() => {
      var cellIDs = pogobuf.Utils.getCellIDs(lat, lng, 5);

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
