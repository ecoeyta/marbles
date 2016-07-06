// ==================================
// Part 2 - incoming messages, look for type
// ==================================
var registrar = null;
var chaincodeID = null;
var async = require('async');
var http = require('http');

module.exports.setup = function (reg, ccID) {
	registrar = reg;
	chaincodeID = ccID;
};

module.exports.process_msg = function (ws, data) {
	if (data.v === 2) {
		if (data.type == 'create') {
			console.log('its a create!');
			if (data.name && data.color && data.size && data.user) {
				var invokeRequest = {
					chaincodeID: chaincodeID,
					fcn: 'init_marble',
					args: [data.name, data.color, data.size, data.user]
				}
				var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

				transactionContext.on('complete', function (results) {
					console.log('create complete!');
				});

				transactionContext.on('error', function (err) {
					console.log(err);
				});
			}
		}
		else if (data.type == 'get') {
			console.log('get marbles msg');
			var queryRequest = {
				chaincodeID: chaincodeID,
				fcn: 'read',
				args: ['_marbleindex']
			}
			var transactionContext = registrar.query(queryRequest)	//create a new marble

			transactionContext.on('complete', function (results) {
				console.log(results);
				cb_got_index(null, results.result);
			});

			transactionContext.on('error', function (err) {
				console.log(err);
			});
		}
		else if (data.type == 'transfer') {
			console.log('transfering msg');
			if (data.name && data.user) {
				var invokeRequest = {
					chaincodeID: chaincodeID,
					fcn: 'set_user',
					args: [data.name, data.user]
				}
				var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

				transactionContext.on('complete', function (results) {
					console.log('transfer complete!');
				});
			}
		}
		else if (data.type == 'remove') {
			console.log('removing msg');
			if (data.name) {
				var invokeRequest = {
					chaincodeID: chaincodeID,
					fcn: 'delete',
					args: [data.name]
				}
				var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

				transactionContext.on('complete', function (results) {
					console.log('delete complete!');
				});
			}
		}
		else if (data.type == 'chainstats') {
			console.log('chainstats msg');

			//get chainstats through REST API
			var options = {
				host: 'ethan-p1.rtp.raleigh.ibm.com',
				port: '5000',
				path: '/chain',
				method: 'GET'
			};

			function success(statusCode, headers, resp) {
				console.log('chainstats success!');
				//console.log(resp);
				cb_chainstats(null, JSON.parse(resp));
			};
			function failure(statusCode, headers, msg) {
				console.log('chainstats failure :(');
				console.log('status code: ' + statusCode);
				console.log('headers: ' + headers);
				console.log('message: ' + msg);
			};

			var goodJSON = false;
			request = http.request(options, function (resp) {
				var str = '', temp, chunks = 0;

				resp.setEncoding('utf8');
				resp.on('data', function (chunk) {															//merge chunks of request
					str += chunk;
					chunks++;
				});
				resp.on('end', function () {																	//wait for end before decision
					if (resp.statusCode == 204 || resp.statusCode >= 200 && resp.statusCode <= 399) {
						success(resp.statusCode, resp.headers, str);
					}
					else {
						failure(resp.statusCode, resp.headers, str);
					}
				});
			});

			request.on('error', function (e) {																//handle error event
				failure(500, null, e);
			});

			request.setTimeout(20000);
			request.on('timeout', function () {																//handle time out event
				failure(408, null, 'Request timed out');
			});

			request.end();

		}
		else if (data.type == 'open_trade') {
			console.log('open_trade msg');
			if (!data.willing || data.willing.length < 0) {
				console.log('error, "willing" is empty');
			}
			else if (!data.want) {
				console.log('error, "want" is empty');
			}
			else {
				var args = [data.user, data.want.color, data.want.size];
				for (var i in data.willing) {
					args.push(data.willing[i].color);
					args.push(data.willing[i].size);
				}

				var invokeRequest = {
					chaincodeID: chaincodeID,
					fcn: 'open_trade',
					args: args
				}
				var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

				transactionContext.on('complete', function (results) {
					console.log('open trade complete!');
				});
			}
		}
		else if (data.type == 'get_open_trades') {
			console.log('get open trades msg');

			var queryRequest = {
				chaincodeID: chaincodeID,
				fcn: 'read',
				args: ['_opentrades']
			}
			var transactionContext = registrar.query(queryRequest)	//create a new marble

			transactionContext.on('complete', function (results) {
				console.log(results);
				cb_got_trades(null, results.result);
			});

			transactionContext.on('error', function (err) {
				console.log(err);
			});
		}
		else if (data.type == 'perform_trade') {
			console.log('perform trade msg');

			var invokeRequest = {
				chaincodeID: chaincodeID,
				fcn: 'perform_trade',
				args: [data.id, data.closer.user, data.closer.name, data.opener.user, data.opener.color, data.opener.size]
			}
			var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

			transactionContext.on('complete', function (results) {
				console.log('perform trade complete!');
			});
		}
		else if (data.type == 'remove_trade') {
			console.log('remove trade msg');

			var invokeRequest = {
				chaincodeID: chaincodeID,
				fcn: 'remove_trade',
				args: [data.id]
			}
			var transactionContext = registrar.invoke(invokeRequest)	//create a new marble

			transactionContext.on('complete', function (results) {
				console.log('remove trade complete!');
			});
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
					//chaincode.query.read([json[i]], cb_got_marble);	

					var queryRequest = {
						args: [json[i]],
						fcn: 'read',
						chaincodeID: chaincodeID
					}

					var transactionContext = registrar.query(queryRequest);
					transactionContext.on('complete', function (data) {
						cb_got_marble(null, data.result);
					});

					transactionContext.on('error', function (err) {
						console.log(err);
					});										//iter over each, read their values
				}
			}
			catch (e) {
				console.log('error:', e);
			}
		}
	}

	//call back for getting a marble, lets send a message
	function cb_got_marble(e, marble) {
		if (e != null) console.log('error:', e);
		else {
			try {
				sendMsg({ msg: 'marbles', marble: JSON.parse(marble) });
			}
			catch (e) { }
		}
	}

	function cb_invoked(e, a) {
		console.log('response: ', e, a);
	}

	//call back for getting the blockchain stats, lets get the block height now
	var chain_stats = {};
	function cb_chainstats(e, stats) {
		chain_stats = stats;
		if (stats && stats.height) {
			var list = [];
			for (var i = stats.height - 1; i >= 1; i--) {								//create a list of heights we need
				list.push(i);
				if (list.length >= 8) break;
			}

			list.reverse();	
			async.eachLimit(list, 1, function (key, cb) {							//iter through each one, and send it
				//get chainstats through REST API
				var options = {
					host: 'ethan-p1.rtp.raleigh.ibm.com',
					port: '5000',
					path: '/chain/blocks/' + key,
					method: 'GET'
				};

				function success(statusCode, headers, stats) {
					stats = JSON.parse(stats);
					stats.height = key;
					sendMsg({ msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
					cb(null);
				};

				function failure(statusCode, headers, msg) {
					console.log('chainstats block ' + key + ' failure :(');
					console.log('status code: ' + statusCode);
					console.log('headers: ' + headers);
					console.log('message: ' + msg);
				};

				var goodJSON = false;
				request = http.request(options, function (resp) {
					var str = '', temp, chunks = 0;

					resp.setEncoding('utf8');
					resp.on('data', function (chunk) {															//merge chunks of request
						str += chunk;
						chunks++;
					});
					resp.on('end', function () {																	//wait for end before decision
						if (resp.statusCode == 204 || resp.statusCode >= 200 && resp.statusCode <= 399) {
							success(resp.statusCode, resp.headers, str);
						}
						else {
							failure(resp.statusCode, resp.headers, str);
						}
					});
				});

				request.on('error', function (e) {																//handle error event
					failure(500, null, e);
				});

				request.setTimeout(20000);
				request.on('timeout', function () {																//handle time out event
					failure(408, null, 'Request timed out');
				});

				request.end();
			}, function () {
			});
		}
	}

	//call back for getting open trades, lets send the trades
	function cb_got_trades(e, trades) {
		if (e != null) console.log('error:', e);
		else {
			try {
				trades = JSON.parse(trades);
				if (trades && trades.open_trades) {
					sendMsg({ msg: 'open_trades', open_trades: trades.open_trades });
				}
			}
			catch (e) { }
		}
	}

	//send a message, socket might be closed...
	function sendMsg(json) {
		if (ws) {
			try {
				ws.send(JSON.stringify(json));
			}
			catch (e) {
				console.log('error ws', e);
			}
		}
	}
};
