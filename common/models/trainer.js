var loopback = require('loopback');
var Pokeio = require('pokemon-go-node-api');
var util = require('util');


module.exports = function(Trainer) {

  Trainer.afterRemote('login', function(ctx, result, next) {
    var location = {
      type: "name",
      name: "Av Chapultepec Sur 284-103, Americana, 44160 Guadalajara, Jal."
    };
    var user = ctx.args.credentials.username;
    var password = ctx.args.credentials.password;

    Pokeio.init(user, password, location, "ptc", function(err) {
      if (err) throw err;

      var WildPokemons = [];

      Pokeio.GetProfile(function(err, profile) {
        if (err) throw err;

        Pokeio.Heartbeat(function(err, hb) {
          if (err) {
            console.log(err);
          }

          hb.cells.forEach(function(item) {
            if(item.WildPokemon.length > 0){
              WildPokemons.push(item.WildPokemon);
            }
          });
          // Wildpokemons in the current area
          console.log(util.inspect(WildPokemons, false, null));
        });
      });
    });
    next();
  });

};
