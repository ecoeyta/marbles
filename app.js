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
var chaincodeName = 'marble_chaincode'
var chain = hlc.newChain(chaincodeName);

// Configure the KeyValStore which is used to store sensitive keys
// as so it is important to secure this storage.
chain.setKeyValStore(hlc.newFileKeyValStore('./tmp/keyValStore'));

// ==================================
// load peers manually or from VCAP, VCAP will overwrite hardcoded list!
// ==================================

var peerURLs = [];
var caURL = null;
var users = null;

var registrar = null; //user used to register other users and deploy chaincode

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
        for (var i in peers) {
          peerURLs.push(
            peers[i].discovery_host + ":" + peers[i].discovery_port
          );
        }
        if (servicesObject[i][0].credentials.ca) {
          console.log('overwritting ca, loading from a vcap service: ', i);
          ca = servicesObject[i][0].credentials.ca;
          caURL = ca.discovery_host + ":" + ca.discovery_port;
          if (servicesObject[i][0].credentials.users) {
            console.log('overwritting users, loading from a vcap service: ', i);
            users = servicesObject[i][0].credentials.users;
            //TODO extract registrar from users once user list has been updated to new SDK
          }
          else users = null;													//no security	
        }
        else ca = null;
        break;
      }
    }
  }
} else {
  console.log('loading hardcoding users and certificate authority...')
  caURL = 'grpc://ethan-ca.rtp.raleigh.ibm.com:50051';
  peerURLs.push('grpc://ethan-p1.rtp.raleigh.ibm.com:30303');
  peerURLs.push('grpc://ethan-p2.rtp.raleigh.ibm.com:30303');
  peerURLs.push('grpc://ethan-p3.rtp.raleigh.ibm.com:30303');

  registrar = {
    'username': 'ethanicus',
    'secret': 'trainisland'
  }
}

// ==================================
// configure hyperledger client sdk
// ==================================
// Set the URL for member services
console.log('adding ca: \'' + caURL + '\'');
chain.setMemberServicesUrl(caURL);

// Add all peers' URL
for (var i in peerURLs) {
  console.log('adding peer with URL: \'' + peerURLs[i] + '\'');
  chain.addPeer(peerURLs[i]);
}

var chaincodeID = null;

console.log('enrolling user \'%s\' with secret \'%s\' as registrar...', registrar.username, registrar.secret);
chain.enroll(registrar.username, registrar.secret, function (err, user) {
  if (err) return console.log('Error: failed to enroll user: %s', err);

  console.log('successfully enrolled user \'%s\'!', registrar.username);
  chain.setRegistrar(user);

  registrar = user;

  var deployRequest = {
    args: ['99'],
    fcn: 'init',
    chaincodePath: 'github.com/marbles-chaincode/hyperledger/part2'
  }
  console.log('deploying chaincode from path %s', deployRequest.chaincodePath)
  var transactionContext = user.deploy(deployRequest);

  transactionContext.on('complete', function (results) {
    console.log('chaincode deployed successfully!');
    console.log('chaincodeID: %s', results.chaincodeID);

    chaincodeID = results.chaincodeID;

    //pass chain to part1 and part2 for use
    part1.setup(user, chaincodeID);
    part2.setup(user, chaincodeID);
    cb_deployed();
  });

  transactionContext.on('error', function (err) {
    console.log('Error deploying chaincode: %s', err.msg);
    console.log('App will fail without chaincode, sorry!');
  });
});

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
    var currWS;
    wss = new ws.Server({ server: server });												//start the websocket now
    wss.on('connection', function connection(ws) {
      currWS = ws;
      ws.on('message', function incoming(message) {
        console.log('received ws msg:', message);
        try {
          var data = JSON.parse(message);
          //part1.process_msg(ws, data);
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


    var marbleCount = 0;
    setInterval(function () { heart_beat() }, 2000);

    function heart_beat(cb) {
      var queryRequestReadMarbleIndex = {
        args: ['_marbleindex'],
        fcn: 'read',
        chaincodeID: chaincodeID
      }

      var transactionContextMarbleIndex = registrar.query(queryRequestReadMarbleIndex);
      transactionContextMarbleIndex.on('complete', function (data) {
        if (data.error) {
          cb_got_index(helper.eFmt('query() resp error', 400, data.error), null);
        } else if (data.result) {
          cb_got_index(null, data.result);
        } else {
          console.log('Error: result did not contain data')
        }
      });

      transactionContextMarbleIndex.on('error', function (err) {
        console.log('error in query');
        console.log(err);
      });

      //got the marble index, lets get each marble
      function cb_got_index(e, index) {
        if (e != null) console.log('error:', e);
        else {
          try {
            var json = JSON.parse(index);
            for (var i in json) {

              var queryRequest = {
                args: [json[i]],
                fcn: 'read',
                chaincodeID: chaincodeID
              }

              var transactionContext = registrar.query(queryRequest);
              transactionContext.on('complete', function (data) {
                var e;
                try {
                  wss.broadcast({ msg: 'marbles', marble: JSON.parse(data.result) });
                  if (json.length != marbleCount) {
                    //console.log('marble count has changed!');
                    //console.log('old marble count: ' + marbleCount);
                    //console.log('new marble count: ' + json.length);
                    marbleCount = json.length;
                    if (currWS) {
                      currWS.send(JSON.stringify({ msg: 'refresh' }));
                    }
                  }
                }
                catch (e) {
                  console.log('marble msg error', e);
                }
              });

              transactionContext.on('error', function (err) {
                console.log(err);
              });
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
    };

    // ========================================================
    // Monitor the height of the blockchain
    // ========================================================
    // ibc.monitor_blockheight(function (chain_stats) {										//there is a new block, lets refresh everything that has a state
    //   if (chain_stats && chain_stats.height) {
    //     console.log('hey new block, lets refresh and broadcast to all');
    //     ibc.block_stats(chain_stats.height - 1, cb_blockstats);
    //     wss.broadcast({ msg: 'reset' });
    //     chaincode.query.read(['_marbleindex'], cb_got_index);
    //     chaincode.query.read(['_opentrades'], cb_got_trades);
    //   }

    //   //got the block's stats, lets send the statistics
    //   function cb_blockstats(e, stats) {
    //     if (e != null) console.log('error:', e);
    //     else {
    //       if (chain_stats.height) stats.height = chain_stats.height - 1;
    //       wss.broadcast({ msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats });
    //     }
    //   }

    //   //got the marble index, lets get each marble
    //   function cb_got_index(e, index) {
    //     if (e != null) console.log('error:', e);
    //     else {
    //       try {
    //         var json = JSON.parse(index);
    //         for (var i in json) {
    //           console.log('!', i, json[i]);
    //           chaincode.query.read([json[i]], cb_got_marble);							//iter over each, read their values
    //         }
    //       }
    //       catch (e) {
    //         console.log('marbles index msg error:', e);
    //       }
    //     }
    //   }

    //   //call back for getting a marble, lets send a message
    //   function cb_got_marble(e, marble) {
    //     if (e != null) console.log('error:', e);
    //     else {
    //       try {
    //         wss.broadcast({ msg: 'marbles', marble: JSON.parse(marble) });
    //       }
    //       catch (e) {
    //         console.log('marble msg error', e);
    //       }
    //     }
    //   }

    //   //call back for getting open trades, lets send the trades
    //   function cb_got_trades(e, trades) {
    //     if (e != null) console.log('error:', e);
    //     else {
    //       try {
    //         trades = JSON.parse(trades);
    //         if (trades && trades.open_trades) {
    //           wss.broadcast({ msg: 'open_trades', open_trades: trades.open_trades });
    //         }
    //       }
    //       catch (e) {
    //         console.log('trade msg error', e);
    //       }
    //     }
    //   }
    // });
  }
}