const pogobuf  = require('pogobuf'),
    POGOProtos = require('node-pogo-protos'),
    bluebird   = require('bluebird'),
    GeoPoint   = require('loopback').GeoPoint,
    crypto     = require('crypto'),
    request    = require('request');

const proxies = [
  '104.251.80.71:29842',
  '104.251.85.44:29842',
  '104.251.80.167:29842',
  '104.251.85.181:29842',
  '104.251.80.112:29842'
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
          if (stolenPokemons.length) {
            pokemons = pokemons.concat(stolenPokemons);
          }

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
    let security = fuckGoRadarSecurity[getRandomInt(0, fuckGoRadarSecurity.length)];

    var opts = {
      //url: `https://stop_fucking_with_us.goradar.io/raw_data_facebook?hash=2619478351&key=3055&time=1472770006&swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}&pokemon=true&pokestops=false&gyms=false`
      url: `https://stop_fucking_with_us.goradar.io/raw_data_facebook?${security}&swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}&pokemon=true&pokestops=false&gyms=false`
    };
    if (process.env.NODE_ENV === "production") {
      let proxy = proxies[getRandomInt(0, proxies.length)];

      opts.proxy = `http://${proxy}`;
    }
    request(opts, function (error, response, body) {
      if (error || response.statusCode !== 200 || !body) {
        return cb(pokemons);
      }

      try {
        body = JSON.parse(body);
      } catch (err) {
        return cb(pokemons);
      }

      if (!body.pokemons) {
        return cb(pokemons);
      }

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

      return cb(pokemons);
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


const fuckGoRadarSecurity = [
  'hash=2153135727&key=5296&time=1473013597',
  'hash=1582369449&key=3263&time=1473013592',
  'hash=2866981177&key=2608&time=1473013587',
  'hash=773967951&key=30439&time=1473013582',
  'hash=4048443908&key=2471&time=1473013577',
  'hash=2589418306&key=5678&time=1473013572',
  'hash=3428841523&key=1086&time=1473013567',
  'hash=1835651067&key=30111&time=1473013562',
  'hash=812774891&key=16376&time=1473013557',
  'hash=281269996&key=29744&time=1473013552',
  'hash=400077835&key=8606&time=1473013547',
  'hash=3410187234&key=17320&time=1473013542',
  'hash=3854488152&key=17375&time=1473013537',
  'hash=2174354995&key=5531&time=1473013532',
  'hash=3941730146&key=6111&time=1473013527',
  'hash=2957991380&key=6510&time=1473013522',
  'hash=829629712&key=5095&time=1473013517',
  'hash=466993244&key=5232&time=1473013512',
  'hash=1234529965&key=13496&time=1473013507',
  'hash=293716224&key=5798&time=1473013502',
  'hash=3833012462&key=5739&time=1473013497',
  'hash=3897129684&key=3240&time=1473013492',
  'hash=398473820&key=2475&time=1473013487',
  'hash=1218456957&key=15979&time=1473013482',
  'hash=4201463134&key=6835&time=1473013477',
  'hash=3548224477&key=2983&time=1473013472',
  'hash=518035296&key=128155&time=1473013467',
  'hash=986004240&key=3182&time=1473013462',
  'hash=3868625639&key=3224&time=1473013457',
  'hash=3649555147&key=3451&time=1473013452',
  'hash=3740260597&key=1680&time=1473013447',
  'hash=553277436&key=1958&time=1473013442',
  'hash=858745431&key=3472&time=1473013437',
  'hash=393052413&key=5791&time=1473013432',
  'hash=2994339687&key=5374&time=1473013427',
  'hash=4136137224&key=15774&time=1473013422',
  'hash=3339159465&key=5278&time=1473013417',
  'hash=1433833448&key=128560&time=1473013412',
  'hash=482013807&key=15782&time=1473013407',
  'hash=845284073&key=5171&time=1473013402',
  'hash=1281760732&key=7743&time=1473013397',
  'hash=521756949&key=5871&time=1473013392',
  'hash=1680891538&key=8167&time=1473013387',
  'hash=2404761793&key=5547&time=1473013382',
  'hash=508564688&key=33183&time=1473013377',
  'hash=955236103&key=5171&time=1473013372',
  'hash=596388088&key=1083&time=1473013367',
  'hash=3669888993&key=63059&time=1473013362',
  'hash=2847627896&key=3439&time=1473013357',
  'hash=1569449715&key=5243&time=1473013352',
  'hash=3148227958&key=4735&time=1473013347',
  'hash=1124660405&key=9107&time=1473013342',
  'hash=1099604098&key=6011&time=1473013337',
  'hash=31195734&key=7662&time=1473013332',
  'hash=298830911&key=3622&time=1473013327',
  'hash=741446164&key=260710&time=1473013322',
  'hash=207337139&key=14680&time=1473013317',
  'hash=4248048905&key=33199&time=1473013312',
  'hash=774544293&key=3192&time=1473013307',
  'hash=628949382&key=5776&time=1473013302',
  'hash=3208508500&key=9775&time=1473013297',
  'hash=2593040679&key=1107&time=1473013292',
  'hash=82621596&key=9139&time=1473013287',
  'hash=70984618&key=5296&time=1473013282',
  'hash=3652345101&key=2542&time=1473013277',
  'hash=4208424183&key=9115&time=1473013272',
  'hash=2810638208&key=13331&time=1473013267',
  'hash=3432477474&key=8632&time=1473013262',
  'hash=2794128447&key=5288&time=1473013257',
  'hash=3609553855&key=3251&time=1473013252',
  'hash=1121700760&key=3451&time=1473013247',
  'hash=2069117868&key=3310&time=1473013242',
  'hash=3373879980&key=32255&time=1473013237',
  'hash=874128681&key=5119&time=1473013232',
  'hash=3539523656&key=29843&time=1473013227',
  'hash=3350427418&key=14776&time=1473013222',
  'hash=3501473696&key=5183&time=1473013217',
  'hash=1200789135&key=67179&time=1473013212',
  'hash=3411463909&key=31120&time=1473013207',
  'hash=2599131574&key=1576&time=1473013202',
  'hash=2848198429&key=63854&time=1473013197',
  'hash=2528881258&key=1726&time=1473013192',
  'hash=1924441853&key=6584&time=1473013187',
  'hash=1200152880&key=5990&time=1473013182',
  'hash=1769336972&key=13487&time=1473013177',
  'hash=4247001002&key=62566&time=1473013172',
  'hash=3470953237&key=3504&time=1473013167',
  'hash=1331905738&key=5648&time=1473013162',
  'hash=1207647969&key=7726&time=1473013157',
  'hash=1957701904&key=1976&time=1473013152',
  'hash=440464603&key=10206&time=1473013147',
  'hash=3207475336&key=13798&time=1473013142',
  'hash=636338371&key=5712&time=1473013137',
  'hash=1075592410&key=3694&time=1473013132',
  'hash=1882962826&key=3487&time=1473013127',
  'hash=3983308125&key=9083&time=1473013122',
  'hash=2706507136&key=5031&time=1473013117',
  'hash=133419455&key=30107&time=1473013112',
  'hash=1054277179&key=6886&time=1473013107',
  'hash=2030648021&key=1715&time=1473013102',
  'hash=366849117&key=3246&time=1473013097',
  'hash=2405364461&key=13983&time=1473013092',
  'hash=2449442368&key=4859&time=1473013087',
  'hash=1341117272&key=32190&time=1473013082',
  'hash=2332101120&key=1151&time=1473013077',
  'hash=755970826&key=14974&time=1473013072',
  'hash=3973203962&key=5551&time=1473013067',
  'hash=2702944615&key=2023&time=1473013062',
  'hash=2740142588&key=5543&time=1473013057',
  'hash=4127519752&key=8624&time=1473013052',
  'hash=92618055&key=3622&time=1473013047',
  'hash=3531529890&key=6736&time=1473013042',
  'hash=3495765706&key=4699&time=1473013037',
  'hash=830604291&key=5099&time=1473013032',
  'hash=3760489&key=5680&time=1473013027',
  'hash=210428728&key=6782&time=1473013022',
  'hash=1381911034&key=1939&time=1473013017',
  'hash=4249410793&key=3239&time=1473013012',
  'hash=1604650143&key=5350&time=1473013007',
  'hash=393754497&key=9771&time=1473013002',
  'hash=909623834&key=5627&time=1473012997',
  'hash=4151642785&key=1791&time=1473012992',
  'hash=4188855280&key=3435&time=1473012987',
  'hash=1736360622&key=5872&time=1473012982',
  'hash=192984741&key=9086&time=1473012977',
  'hash=547258661&key=5279&time=1473012972',
  'hash=3061717239&key=62566&time=1473012967',
  'hash=2727602758&key=1512&time=1473012962',
  'hash=1247820170&key=13931&time=1473012957',
  'hash=349389131&key=5619&time=1473012952',
  'hash=2107583572&key=3051&time=1473012947',
  'hash=558274051&key=66463&time=1473012942',
  'hash=3598517482&key=5267&time=1473012937',
  'hash=3716342914&key=4526&time=1473012932',
  'hash=947148882&key=31135&time=1473012927',
  'hash=1332026590&key=3448&time=1473012922',
  'hash=1178958929&key=3502&time=1473012917',
  'hash=1587285170&key=2174&time=1473012912',
  'hash=60431546&key=2159&time=1473012907',
  'hash=650108057&key=2491&time=1473012902',
  'hash=3655010976&key=1471&time=1473012897',
  'hash=4236755565&key=6063&time=1473012892',
  'hash=4136921458&key=5295&time=1473012887',
  'hash=724668094&key=2456&time=1473012882',
  'hash=1818703545&key=8622&time=1473012877',
  'hash=3334486562&key=2030&time=1473012872',
  'hash=2908865990&key=5295&time=1473012867',
  'hash=3796891372&key=8302&time=1473012862',
  'hash=2515271810&key=6491&time=1473012857',
  'hash=3167509707&key=2491&time=1473012852',
  'hash=1218696223&key=31270&time=1473012847',
  'hash=1675303058&key=63888&time=1473012842',
  'hash=4185326291&key=5528&time=1473012837',
  'hash=3472020693&key=16799&time=1473012832',
  'hash=1882941027&key=5030&time=1473012827',
  'hash=3106140543&key=13439&time=1473012822',
  'hash=3835435833&key=1582&time=1473012817',
  'hash=2963503539&key=13499&time=1473012812',
  'hash=709794584&key=1147&time=1473012807',
  'hash=1002461150&key=17400&time=1473012802',
  'hash=2134134179&key=3192&time=1473012797',
  'hash=2987972092&key=17552&time=1473012792',
  'hash=3916728694&key=5359&time=1473012787',
  'hash=3482699203&key=5183&time=1473012782',
  'hash=3575898845&key=6062&time=1473012777',
  'hash=590921503&key=2483&time=1473012772',
  'hash=125905770&key=1583&time=1473012767',
  'hash=1228312456&key=129790&time=1473012762',
  'hash=1988465323&key=260024&time=1473012757',
  'hash=4006974195&key=260019&time=1473012752',
  'hash=4002852617&key=2960&time=1473012747',
  'hash=3183225964&key=2622&time=1473012742',
  'hash=2833888565&key=8606&time=1473012737',
  'hash=1450427559&key=7667&time=1473012732',
  'hash=2799892846&key=13423&time=1473012727',
  'hash=1273754944&key=8638&time=1473012722',
  'hash=360786087&key=5648&time=1473012717',
  'hash=1544477139&key=29851&time=1473012712',
  'hash=261516780&key=3227&time=1473012707',
  'hash=701290180&key=17406&time=1473012702',
  'hash=813967400&key=4799&time=1473012697',
  'hash=1672123778&key=65662&time=1473012692',
  'hash=3848492882&key=16895&time=1473012687',
  'hash=3232999862&key=5176&time=1473012682',
  'hash=4285090462&key=5747&time=1473012677',
  'hash=2792430676&key=1680&time=1473012672',
  'hash=406498343&key=1662&time=1473012667',
  'hash=575383795&key=6639&time=1473012662',
  'hash=1845421389&key=7590&time=1473012657',
  'hash=302063019&key=2171&time=1473012652',
  'hash=2920984525&key=2064&time=1473012647',
  'hash=2766085094&key=1576&time=1473012642',
  'hash=4125784248&key=9855&time=1473012637',
  'hash=1379505845&key=132263&time=1473012632',
  'hash=3476187337&key=5680&time=1473012627',
  'hash=3531725841&key=1787&time=1473012622',
  'hash=4202242730&key=5267&time=1473012617',
  'hash=1058970547&key=1435&time=1473012612',
  'hash=3228207911&key=2030&time=1473012607',
  'hash=2540344084&key=128550&time=1473012602',
  'hash=1528835205&key=1630&time=1473012597',
  'hash=766046640&key=16376&time=1473012592',
  'hash=62391579&key=6702&time=1473012587',
  'hash=4086497406&key=6768&time=1473012582',
  'hash=4176526804&key=2463&time=1473012577',
  'hash=711734281&key=13423&time=1473012572',
  'hash=640168760&key=13851&time=1473012567',
  'hash=191230244&key=16350&time=1473012562',
  'hash=1531705538&key=8859&time=1473012557',
  'hash=3275614074&key=5054&time=1473012552',
  'hash=2051529685&key=2040&time=1473012547',
  'hash=3557054159&key=17575&time=1473012542',
  'hash=654612662&key=66107&time=1473012537',
  'hash=1458442845&key=62495&time=1473012532',
  'hash=3256350732&key=8603&time=1473012527',
  'hash=4075354312&key=8766&time=1473012522',
  'hash=3354310546&key=9115&time=1473012517',
  'hash=1812412276&key=9744&time=1473012512',
  'hash=4040218527&key=17310&time=1473012507',
  'hash=773008658&key=2024&time=1473012502',
  'hash=4230510948&key=10207&time=1473012497',
  'hash=1630827581&key=13743&time=1473012492',
  'hash=1816297733&key=6832&time=1473012487',
  'hash=794516801&key=1715&time=1473012482',
  'hash=117115294&key=6011&time=1473012477',
  'hash=3787037503&key=259227&time=1473012472',
  'hash=1377473312&key=128147&time=1473012467',
  'hash=97678439&key=13439&time=1473012462',
  'hash=140473544&key=14015&time=1473012457',
  'hash=2166887157&key=62591&time=1473012452',
  'hash=508131877&key=14768&time=1473012447',
  'hash=3066275362&key=7568&time=1473012442',
  'hash=3805674069&key=16366&time=1473012437',
  'hash=87961421&key=3559&time=1473012432',
  'hash=3577235974&key=6559&time=1473012427',
  'hash=920788938&key=3608&time=1473012422',
  'hash=245096791&key=6904&time=1473012417',
  'hash=2271074870&key=31038&time=1473012412',
  'hash=3986427322&key=2623&time=1473012407',
  'hash=3218415887&key=6847&time=1473012402',
  'hash=1338747907&key=1976&time=1473012397',
  'hash=2754259455&key=6635&time=1473012392',
  'hash=3834360468&key=15771&time=1473012387',
  'hash=2236065081&key=5755&time=1473012382',
  'hash=3612173438&key=6139&time=1473012377',
  'hash=2600106937&key=13479&time=1473012372',
  'hash=4194331865&key=1128&time=1473012367',
  'hash=2068502407&key=17567&time=1473012362',
  'hash=851166294&key=6011&time=1473012357',
  'hash=2436925178&key=5086&time=1473012352',
  'hash=2369623357&key=259736&time=1473012347',
  'hash=664785045&key=2987&time=1473012342',
  'hash=990024337&key=129470&time=1473012337',
  'hash=2413168269&key=7519&time=1473012332',
  'hash=2407188803&key=4846&time=1473012327',
  'hash=1869714575&key=259903&time=1473012322',
  'hash=400308043&key=9448&time=1473012317',
  'hash=760288984&key=33208&time=1473012312',
  'hash=4177901722&key=9063&time=1473012307',
  'hash=1883078468&key=3102&time=1473012302',
  'hash=3437257092&key=6823&time=1473012297',
  'hash=142091156&key=5240&time=1473012292',
  'hash=1084315039&key=30310&time=1473012287',
  'hash=204053526&key=259224&time=1473012282',
  'hash=3910350289&key=13998&time=1473012277',
  'hash=2212776449&key=4799&time=1473012272',
  'hash=3716007177&key=5520&time=1473012267',
  'hash=1332255867&key=2047&time=1473012262',
  'hash=859870193&key=128158&time=1473012257',
  'hash=1141277168&key=6832&time=1473012252',
  'hash=1650409794&key=2175&time=1473012247',
  'hash=3411656494&key=2488&time=1473012242',
  'hash=1364572250&key=9835&time=1473012237',
  'hash=1621241198&key=2014&time=1473012232',
  'hash=2102798640&key=4499&time=1473012227',
  'hash=2994163533&key=2475&time=1473012222',
  'hash=3183017118&key=1403&time=1473012217',
  'hash=1150005340&key=3224&time=1473012212',
  'hash=4184319426&key=5823&time=1473012207',
  'hash=2615170226&key=30512&time=1473012202',
  'hash=2699388400&key=5759&time=1473012197',
  'hash=4273277822&key=5222&time=1473012192',
  'hash=3952764419&key=5734&time=1473012187',
  'hash=2088211987&key=521839&time=1473012182',
  'hash=1594916312&key=1775&time=1473012177',
  'hash=1060556010&key=1950&time=1473012172',
  'hash=1981948153&key=3000&time=1473012167',
  'hash=2300858748&key=2470&time=1473012162',
  'hash=567747008&key=6695&time=1473012157',
  'hash=3079562324&key=5296&time=1473012152',
  'hash=3459472367&key=29950&time=1473012147',
  'hash=1811708335&key=8295&time=1473012142',
  'hash=1985156478&key=62955&time=1473012137',
  'hash=652774103&key=6107&time=1473012132',
  'hash=1822454649&key=14840&time=1473012127',
  'hash=947282555&key=6911&time=1473012122',
  'hash=1553686575&key=3248&time=1473012117',
  'hash=1426678820&key=5264&time=1473012112',
  'hash=4076058642&key=9447&time=1473012107',
  'hash=1749659115&key=1087&time=1473012102',
  'hash=516047176&key=2991&time=1473012097',
  'hash=2273958307&key=16891&time=1473012092',
  'hash=1014825865&key=6584&time=1473012087',
  'hash=3780813884&key=5350&time=1473012082',
  'hash=4093349802&key=3579&time=1473012077',
  'hash=374364005&key=32167&time=1473012072',
  'hash=3660331109&key=9384&time=1473012067',
  'hash=2369084700&key=30686&time=1473012062',
  'hash=618414945&key=6558&time=1473012057',
  'hash=2741335593&key=13863&time=1473012052',
  'hash=1849853137&key=5624&time=1473012047',
  'hash=54560057&key=5683&time=1473012042',
  'hash=4036881668&key=5295&time=1473012037',
  'hash=2817767730&key=9790&time=1473012032',
  'hash=3246624756&key=2491&time=1473012027',
  'hash=2946011627&key=2559&time=1473012022',
  'hash=1778322991&key=1144&time=1473012017',
  'hash=868976180&key=5240&time=1473012012',
  'hash=4239707362&key=5295&time=1473012007',
  'hash=1512306392&key=13918&time=1473012002',
  'hash=3090407457&key=2470&time=1473011997',
  'hash=725947011&key=64379&time=1473011992',
  'hash=3279075980&key=8955&time=1473011987',
  'hash=2887017390&key=6544&time=1473011982',
  'hash=2986608670&key=5099&time=1473011977',
  'hash=424534531&key=2987&time=1473011972',
  'hash=3248550515&key=2110&time=1473011967',
  'hash=910640469&key=5275&time=1473011962',
  'hash=2097621661&key=4638&time=1473011957',
  'hash=3500234986&key=17534&time=1473011952',
  'hash=3057477892&key=5179&time=1473011947',
  'hash=953743288&key=15846&time=1473011942',
  'hash=2515652033&key=2046&time=1473011937',
  'hash=3741172159&key=2427&time=1473011932',
  'hash=1806772837&key=4496&time=1473011927',
  'hash=2516670465&key=32083&time=1473011922',
  'hash=1090805237&key=1982&time=1473011917',
  'hash=2985499665&key=63871&time=1473011912',
  'hash=2857664030&key=1919&time=1473011907',
  'hash=3156355685&key=4595&time=1473011902',
  'hash=1671830984&key=63039&time=1473011897',
  'hash=3446887814&key=29854&time=1473011892',
  'hash=2897613845&key=63918&time=1473011889',
  'hash=3986543320&key=31272&time=1473011888',
  'hash=3170119738&key=3431&time=1473011887',
  'hash=1855837116&key=16830&time=1473013622',
  'hash=2493546474&key=5243&time=1473013617',
  'hash=81455534&key=3582&time=1473013612',
  'hash=1659391169&key=31720&time=1473013607',
  'hash=2970908145&key=13395&time=1473013602'
];
