'use strict';
/* global process */
/* global __dirname */
/*******************************************************************************
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved. 
 *
 * Contributors:
 *   David Huffman - Initial implementation
 *******************************************************************************/
/////////////////////////////////////////
///////////// Setup Node.js /////////////
/////////////////////////////////////////
var express = require('express');
var session = require('express-session');
var compression = require('compression');
var serve_static = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var app = express();
var url = require('url');
var setup = require('./setup');
var cors = require('cors');

//// Set Server Parameters ////
var host = setup.SERVER.HOST;
var port = setup.SERVER.PORT;

////////  Pathing and Module Setup  ////////
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.engine('.html', require('jade').__express);
app.use(compression());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use('/cc/summary', serve_static(path.join(__dirname, 'cc_summaries')));												//for chaincode investigator
app.use(serve_static(path.join(__dirname, 'public'), { maxAge: '1d', setHeaders: setCustomCC }));							//1 day cache
//app.use( serve_static(path.join(__dirname, 'public')) );
app.use(session({ secret: 'Somethignsomething1234!test', resave: true, saveUninitialized: true }));
function setCustomCC(res, path) {
  if (serve_static.mime.lookup(path) === 'image/jpeg') res.setHeader('Cache-Control', 'public, max-age=2592000');		//30 days cache
  else if (serve_static.mime.lookup(path) === 'image/png') res.setHeader('Cache-Control', 'public, max-age=2592000');
  else if (serve_static.mime.lookup(path) === 'image/x-icon') res.setHeader('Cache-Control', 'public, max-age=2592000');
}
// Enable CORS preflight across the board.
app.options('*', cors());
app.use(cors());

///////////  Configure Webserver  ///////////
app.use(function (req, res, next) {
  var keys;
  console.log('------------------------------------------ incoming request ------------------------------------------');
  console.log('New ' + req.method + ' request for', req.url);
  req.bag = {};											//create my object for my stuff
  req.bag.session = req.session;

  var url_parts = url.parse(req.url, true);
  req.parameters = url_parts.query;
  keys = Object.keys(req.parameters);
  if (req.parameters && keys.length > 0) console.log({ parameters: req.parameters });		//print request parameters
  keys = Object.keys(req.body);
  if (req.body && keys.length > 0) console.log({ body: req.body });						//print request body
  next();
});

//// Router ////
app.use('/', require('./routes/site_router'));

////////////////////////////////////////////
////////////// Error Handling //////////////
////////////////////////////////////////////
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});
app.use(function (err, req, res, next) {		// = development error handler, print stack trace
  console.log('Error Handeler -', req.url);
  var errorCode = err.status || 500;
  res.status(errorCode);
  req.bag.error = { msg: err.stack, status: errorCode };
  if (req.bag.error.status == 404) req.bag.error.msg = 'Sorry, I cannot locate that file';
  res.render('template/error', { bag: req.bag });
});

// ============================================================================================================================
// 														Launch Webserver
// ============================================================================================================================
var server = http.createServer(app).listen(port, function () { });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.NODE_ENV = 'production';
server.timeout = 240000;																							// Ta-da.
console.log('------------------------------------------ Server Up - ' + host + ':' + port + ' ------------------------------------------');
if (process.env.PRODUCTION) console.log('Running using Production settings');
else console.log('Running using Developer settings');

// ============================================================================================================================
// 														Deployment Tracking
// ============================================================================================================================
console.log('- Tracking Deployment');
require('cf-deployment-tracker-client').track();		//reports back to us, this helps us judge interest! feel free to remove it

// ============================================================================================================================
// ============================================================================================================================
// ============================================================================================================================
// ============================================================================================================================
// ============================================================================================================================
// ============================================================================================================================

// ============================================================================================================================
// 														Warning
// ============================================================================================================================

// ============================================================================================================================
// 														Entering
// ============================================================================================================================

// ============================================================================================================================
// 														Test Area
// ============================================================================================================================
var part1 = require('./utils/ws_part1');
var part2 = require('./utils/ws_part2');
var ws = require('ws');
var wss = {};
var hlc = require('hlc');

// Create a client chain.
var chain = hlc.newChain("targetChain");

// Configure the KeyValStore which is used to store sensitive keys
// as so it is important to secure this storage.
chain.setKeyValStore( hlc.newFileKeyValStore('./tmp/keyValStore') );

// Set the URL for member services
chain.setMemberServicesUrl("grpc://localhost:50051");

// Add a peer's URL
chain.addPeer("grpc://localhost:30303");

// ==================================
// load peers manually or from VCAP, VCAP will overwrite hardcoded list!
// ==================================
//this hard coded list is intentionaly left here, feel free to use it when initially starting out
//please create your own network when you are up and running
var manual = {
  "credentials": {
    "peers": [
      {
        "discovery_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp1-discovery.blockchain.ibm.com",
        "discovery_port": 30303,
        "api_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp1-api.blockchain.ibm.com",
        "api_port_tls": 443,
        "api_port": 80,
        "type": "peer",
        "network_id": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527",
        "container_id": "deb95d91457ad44b33c267ccf4513d78da12f62256881d731cb44d585317817c",
        "id": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp1",
        "api_url": "http://e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp1-api.blockchain.ibm.com:80"
      },
      {
        "discovery_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp2-discovery.blockchain.ibm.com",
        "discovery_port": 30303,
        "api_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp2-api.blockchain.ibm.com",
        "api_port_tls": 443,
        "api_port": 80,
        "type": "peer",
        "network_id": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527",
        "container_id": "a90203462cdfc702f39eb0e23aab8275ed553a9b2a87cd6275f7da436f0c8616",
        "id": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp2",
        "api_url": "http://e140a9ba-1456-4a9a-8db2-a61fa3d6b527_vp2-api.blockchain.ibm.com:80"
      }
    ],
    "ca": {
      "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_ca": {
        "url": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_ca-api.blockchain.ibm.com:30303",
        "discovery_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_ca-discovery.blockchain.ibm.com",
        "discovery_port": 30303,
        "api_host": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527_ca-api.blockchain.ibm.com",
        "api_port_tls": 30303,
        "api_port": 80,
        "type": "ca",
        "network_id": "e140a9ba-1456-4a9a-8db2-a61fa3d6b527",
        "container_id": "51459c0ba7f32c0ead25e2b0870e4812fda6ba1df820f1480fe4c956ef39e90e"
      }
    },
    "users": [
      {
        "username": "dashboarduser_type0_9efa87fcd4",
        "secret": "76cc8a27bf",
        "enrollId": "dashboarduser_type0_9efa87fcd4",
        "enrollSecret": "76cc8a27bf"
      },
      {
        "username": "dashboarduser_type0_d99cd1c85e",
        "secret": "e1d238a30f",
        "enrollId": "dashboarduser_type0_d99cd1c85e",
        "enrollSecret": "e1d238a30f"
      },
      {
        "username": "user_type1_e408042b7a",
        "secret": "0b45f81f0e",
        "enrollId": "user_type1_e408042b7a",
        "enrollSecret": "0b45f81f0e"
      },
      {
        "username": "user_type1_de474457ef",
        "secret": "ff6c9f0723",
        "enrollId": "user_type1_de474457ef",
        "enrollSecret": "ff6c9f0723"
      },
      {
        "username": "user_type1_d9bc2a4e91",
        "secret": "7c77ca8089",
        "enrollId": "user_type1_d9bc2a4e91",
        "enrollSecret": "7c77ca8089"
      },
      {
        "username": "user_type1_1e8da9ae0a",
        "secret": "db62ec96fe",
        "enrollId": "user_type1_1e8da9ae0a",
        "enrollSecret": "db62ec96fe"
      },
      {
        "username": "user_type1_450eb81d16",
        "secret": "412532b1ae",
        "enrollId": "user_type1_450eb81d16",
        "enrollSecret": "412532b1ae"
      },
      {
        "username": "user_type2_55637d40b0",
        "secret": "393a377635",
        "enrollId": "user_type2_55637d40b0",
        "enrollSecret": "393a377635"
      },
      {
        "username": "user_type2_fc56c098e4",
        "secret": "d2231fd800",
        "enrollId": "user_type2_fc56c098e4",
        "enrollSecret": "d2231fd800"
      },
      {
        "username": "user_type2_0002d9307d",
        "secret": "b3d54c2292",
        "enrollId": "user_type2_0002d9307d",
        "enrollSecret": "b3d54c2292"
      },
      {
        "username": "user_type2_0a1286ae88",
        "secret": "b7fc82253e",
        "enrollId": "user_type2_0a1286ae88",
        "enrollSecret": "b7fc82253e"
      },
      {
        "username": "user_type2_cf9bfb2618",
        "secret": "5b34f0e7aa",
        "enrollId": "user_type2_cf9bfb2618",
        "enrollSecret": "5b34f0e7aa"
      },
      {
        "username": "user_type4_620d8df5c9",
        "secret": "e6a819023a",
        "enrollId": "user_type4_620d8df5c9",
        "enrollSecret": "e6a819023a"
      },
      {
        "username": "user_type4_2f77683e11",
        "secret": "9b582ee2ac",
        "enrollId": "user_type4_2f77683e11",
        "enrollSecret": "9b582ee2ac"
      },
      {
        "username": "user_type4_4e2f00c935",
        "secret": "894ba6f280",
        "enrollId": "user_type4_4e2f00c935",
        "enrollSecret": "894ba6f280"
      },
      {
        "username": "user_type4_c0b65d184e",
        "secret": "287646c2ed",
        "enrollId": "user_type4_c0b65d184e",
        "enrollSecret": "287646c2ed"
      },
      {
        "username": "user_type4_00baebef00",
        "secret": "6ff7ba676e",
        "enrollId": "user_type4_00baebef00",
        "enrollSecret": "6ff7ba676e"
      },
      {
        "username": "user_type8_59f800e7cc",
        "secret": "a2bd47df6f",
        "enrollId": "user_type8_59f800e7cc",
        "enrollSecret": "a2bd47df6f"
      },
      {
        "username": "user_type8_cc0526de27",
        "secret": "6049475a36",
        "enrollId": "user_type8_cc0526de27",
        "enrollSecret": "6049475a36"
      },
      {
        "username": "user_type8_72cee1a420",
        "secret": "76df56e0b0",
        "enrollId": "user_type8_72cee1a420",
        "enrollSecret": "76df56e0b0"
      },
      {
        "username": "user_type8_d8b1c9d471",
        "secret": "510cd1e885",
        "enrollId": "user_type8_d8b1c9d471",
        "enrollSecret": "510cd1e885"
      },
      {
        "username": "user_type8_62e1a915b9",
        "secret": "fb7e5dc525",
        "enrollId": "user_type8_62e1a915b9",
        "enrollSecret": "fb7e5dc525"
      }
    ]
  }
};
var peers = manual.credentials.peers;
console.log('loading hardcoded peers');
var ca = manual.credentials.ca;
console.log('loading hardcoded certificate authority');
var users = null;																		//users are only found if security is on
if (manual.credentials.users) users = manual.credentials.users;
console.log('loading hardcoded users');

if (process.env.VCAP_SERVICES) {															//load from vcap, search for service, 1 of the 3 should be found...
  var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
  for (var i in servicesObject) {
    if (i.indexOf('ibm-blockchain') >= 0) {											//looks close enough
      if (servicesObject[i][0].credentials.error) {
        console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
        peers = null;
        users = null;
        process.error = { type: 'network', msg: 'Due to overwhelming demand the IBM Blockchain Network service is at maximum capacity.  Please try recreating this service at a later date.' };
      }
      if (servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers) {
        console.log('overwritting peers, loading from a vcap service: ', i);
        peers = servicesObject[i][0].credentials.peers;
        if (servicesObject[i][0].credentials.ca) {
          console.log('overwritting ca, loading from a vcap service: ', i);
          ca = servicesObject[i][0].credentials.ca;
          if (servicesObject[i][0].credentials.users) {
            console.log('overwritting users, loading from a vcap service: ', i);
            users = servicesObject[i][0].credentials.users;
          }
          else users = null;													//no security	
        }
        else ca = null;
        break;
      }
    }
  }
}

// ==================================
// configure hyperledger client sdk
// ==================================
// Set the URL for member services
chain.setMemberServicesUrl("grpc://" + ca[peers[0].network_id + "_ca"].url);

// Add all peers' URL
for (var i in peers) {
  chain.addPeer("grpc://" + i.api_url);
}
//chain.addPeer("grpc://" + peers[0].api_url);

chain.enroll("WebAppAdmin", "DJY27pEnl16d", function (err, webAppAdmin) {
  if (err) return console.log("ERROR: failed to register %s: %s", err);
  // Successfully enrolled WebAppAdmin during initialization.
  // Set this user as the chain's registrar which is authorized to register other users.
  chain.setRegistrar(webAppAdmin);

  var deployRequest = {
    args: [],
    chaincodeID: "https://github.com/ibm-blockchain/marbles-chaincode/hyperledger/part2",
    fnc: "init"
  };
  webAppAdmin.deploy(deployRequest);
});

function cb_ready() {																	//response has chaincode functions
  if (err != null) {
    console.log('! looks like an error loading the chaincode or network, app will fail\n', err);
    if (!process.error) process.error = { type: 'load', msg: err.details };				//if it already exist, keep the last error
  }
  else {
    chaincode = cc;
    part1.setup(ibc, cc);
    part2.setup(ibc, cc);
    if (!cc.details.deployed_name || cc.details.deployed_name === '') {					//decide if i need to deploy
      cc.deploy('init', ['99'], { save_path: './cc_summaries', delay_ms: 50000 }, cb_deployed);
    }
    else {
      console.log('chaincode summary file indicates chaincode has been previously deployed');
      cb_deployed();
    }
  }
}

// ============================================================================================================================
// 												WebSocket Communication Madness
// ============================================================================================================================
function cb_deployed(e, d) {
  if (e != null) {
    //look at tutorial_part1.md in the trouble shooting section for help
    console.log('! looks like a deploy error, holding off on the starting the socket\n', e);
    if (!process.error) process.error = { type: 'deploy', msg: e.details };
  }
  else {
    console.log('------------------------------------------ Websocket Up ------------------------------------------');

    wss = new ws.Server({ server: server });												//start the websocket now
    wss.on('connection', function connection(ws) {
      ws.on('message', function incoming(message) {
        console.log('received ws msg:', message);
        try {
          var data = JSON.parse(message);
          part1.process_msg(ws, data);
          part2.process_msg(ws, data);
        }
        catch (e) {
          console.log('ws message error', e);
        }
      });

      ws.on('error', function (e) { console.log('ws error', e); });
      ws.on('close', function () { console.log('ws closed'); });
    });

    wss.broadcast = function broadcast(data) {											//send to all connections			
      wss.clients.forEach(function each(client) {
        try {
          data.v = '2';
          client.send(JSON.stringify(data));
        }
        catch (e) {
          console.log('error broadcast ws', e);
        }
      });
    };

    // ========================================================
    // Monitor the height of the blockchain
    // ========================================================
    ibc.monitor_blockheight(function (chain_stats) {										//there is a new block, lets refresh everything that has a state
      if (chain_stats && chain_stats.height) {
        console.log('hey new block, lets refresh and broadcast to all');
        ibc.block_stats(chain_stats.height - 1, cb_blockstats);
        wss.broadcast({ msg: 'reset' });
        chaincode.query.read(['_marbleindex'], cb_got_index);
        chaincode.query.read(['_opentrades'], cb_got_trades);
      }

      //got the block's stats, lets send the statistics
      function cb_blockstats(e, stats) {
        if (e != null) console.log('error:', e);
        else {
          if (chain_stats.height) stats.height = chain_stats.height - 1;
          wss.broadcast({ msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats });
        }
      }

      //got the marble index, lets get each marble
      function cb_got_index(e, index) {
        if (e != null) console.log('error:', e);
        else {
          try {
            var json = JSON.parse(index);
            for (var i in json) {
              console.log('!', i, json[i]);
              chaincode.query.read([json[i]], cb_got_marble);							//iter over each, read their values
            }
          }
          catch (e) {
            console.log('marbles index msg error:', e);
          }
        }
      }

      //call back for getting a marble, lets send a message
      function cb_got_marble(e, marble) {
        if (e != null) console.log('error:', e);
        else {
          try {
            wss.broadcast({ msg: 'marbles', marble: JSON.parse(marble) });
          }
          catch (e) {
            console.log('marble msg error', e);
          }
        }
      }

      //call back for getting open trades, lets send the trades
      function cb_got_trades(e, trades) {
        if (e != null) console.log('error:', e);
        else {
          try {
            trades = JSON.parse(trades);
            if (trades && trades.open_trades) {
              wss.broadcast({ msg: 'open_trades', open_trades: trades.open_trades });
            }
          }
          catch (e) {
            console.log('trade msg error', e);
          }
        }
      }
    });
  }
}