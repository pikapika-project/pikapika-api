var loopback = require('loopback'),
    Pokeio = require('pokemon-go-node-api');

module.exports = function(Trainer) {

  Trainer.afterRemote('login', function(ctx, result, next) {
    var location = {
      type: "name",
      name: "Av Chapultepec Sur 284-103, Americana, 44160 Guadalajara, Jal."
    };
    var user = ctx.args.credentials.username;
    var password  = ctx.args.credentials.password;

    Pokeio.init(user, password, location, "ptc", function(err) {
      if (err) throw err;

      console.log('[i] Current location: ' + Pokeio.playerInfo.locationName);
      console.log('[i] lat/long/alt: : ' + Pokeio.playerInfo.latitude + ' ' + Pokeio.playerInfo.longitude + ' ' + Pokeio.playerInfo.altitude);

      Pokeio.GetProfile(function(err, profile) {
        if (err) throw err;

        console.log('[i] Username: ' + profile.username);
        console.log('[i] Poke Storage: ' + profile.poke_storage);
        console.log('[i] Item Storage: ' + profile.item_storage);

        var poke = 0;
        if (profile.currency[0].amount) {
          poke = profile.currency[0].amount;
        }

        console.log('[i] Pokecoin: ' + poke);
        console.log('[i] Stardust: ' + profile.currency[1].amount);

      });
    })
    next();
  });

};
