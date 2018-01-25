var config = require('./src/core/config.js');
var express = require('express');
var app = express();
var api = require('./src/api/api.js')(app);		// apis implementation is here

// server listens
var server = app.listen(config.serverListenPort, function() {
	var host = server.address().address;
	var port = server.address().port;

	console.log('listen at %s:%s', host, port);
});

// close database whenever we receive SIGINT
process.on('SIGINT', function() {
		api.close();
		server.close();
});
