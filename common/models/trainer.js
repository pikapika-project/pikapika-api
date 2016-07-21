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

      console.log(Pokeio.playerInfo)
      console.log('[i] Current location: ' + Pokeio.playerInfo.locationName);
      console.log('[i] lat/long/alt: : ' + Pokeio.playerInfo.latitude + ' ' + Pokeio.playerInfo.longitude + ' ' + Pokeio.playerInfo.altitude);

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
        console.log(util.inspect(WildPokemons, false, null));
        });

      });
    });
    
    next();
  });

};
