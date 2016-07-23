var PokemonGO = require('pokemon-go-node-api');
const s2 = require('s2geometry-node');

module.exports = function(app) {
  app.get('/pokemons/:lat/:lng/all', function(req, res) {

    if (!req.query.access_token || !req.params.lat || !req.params.lng) {
      res.status(404).json({
        error: {
          statusCode: 404,
          statusMessage: "Missing parameters."
        }
      });
    }

    Trainer = app.models.trainer;
    var logedTrainer = [];
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
        var coords = {
          type: "coords",
          coords: {
            latitude: parseFloat(req.params.lat),
            longitude: parseFloat(req.params.lng),
            altitude: 0
          }
        };
        var WildPokemons = [];
        var NearbyPokemons = [];
        var MapPokemons = [];
        var cells = []
        var Pokeio = new PokemonGO.Pokeio();

        Pokeio.playerInfo = returnedInstance[0];

        Pokeio.Heartbeat(function(err, hb) {
          if (err) {
            sendError(err, res);
            return false;
          }
          hb.cells.forEach(function(cell) {

            // Getting Ubcation of each cell

            var cellId = new s2.S2CellId(cell.S2CellId.toString());
            var thisCell = new s2.S2Cell(cellId);
            var latLng = new s2.S2LatLng(thisCell.getCenter()).toString();
            latLng = latLng.split(',');

            cells.push({
              lat: latLng[0],
              lng: latLng[1]
            });
            if (cell.WildPokemon.length > 0) {
              WildPokemons = cell.WildPokemon;
              WildPokemons.forEach(function(wp, i) {
                wp.pokemon.PokemonName = Pokeio.pokemonlist[wp.pokemon.PokemonId - 1].name;
              });
            }
            if (cell.NearbyPokemon.length > 0) {
              NearbyPokemons.push(cell.NearbyPokemon)
            }
            if (cell.MapPokemon.length > 0) {
              MapPokemons.push(cell.MapPokemon)
            }
          });

          res.json({
            data: WildPokemons,
            nerby: NearbyPokemons,
            MapPokemons: MapPokemons
          });
        });
      }
    });
  });


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
