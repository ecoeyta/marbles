// ==================================
// Part 1 - incoming messages, look for type
// ==================================
var registrar = null;
var chaincodeID = null;
var async = require('async');

module.exports.setup = function (reg, ccID) {
	registrar = reg;
	chaincodeID = ccID;
};

module.exports.process_msg = function (ws, data) {
	if (data.v === 1) {
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
					console.log(results);
				});

				transactionContext.on('error', function(err) {
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
				console.log('get complete!');
				cb_got_index(null, results.result);
			});

			transactionContext.on('error', function(err) {
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
				console.log(resp);
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
	}

	//got the marble index, lets get each marble
	function cb_got_index(e, index) {
		if (e != null) console.log('error:', e);
		else {
			if (index == "null") return;

			try {
				var json = JSON.parse(index);
				var keys = Object.keys(json);
				var concurrency = 1;

				//serialized version
				async.eachLimit(keys, concurrency, function (key, cb) {
					//console.log('!', json[key]);

					var queryRequest = {
						args: [json[key]],
						fcn: 'read',
						chaincodeID: chaincodeID
					}

					var transactionContext = registrar.query(queryRequest);
					transactionContext.on('complete', function (data) {
						sendMsg({ msg: 'marbles', e: e, marble: JSON.parse(data.result) });
						cb(null);
					});

					transactionContext.on('error', function(err) {
						console.log(err);
					});
				}, function () {
					sendMsg({ msg: 'action', e: e, status: 'finished' });
				});
			}
			catch (e) {
				console.log('error:', e);
			}
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

			list.reverse();															//flip it so order is correct in UI
			console.log(list);
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
					console.log('stats:');
					console.log(stats);
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