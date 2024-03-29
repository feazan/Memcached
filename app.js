var express = require('express');
var mysql = require('mysql');
var Memcached = require('memcached');

var app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res, next) => {
	res.render('home');
});

var connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: 'root',
	database: 'hw7'
});

connection.connect();
var memcached = new Memcached('localhost:11211');

app.get('/hw7', (req, res, next) => {
	var club = req.query.club;
	var pos = req.query.pos;
	if (!club || !pos) res.return({ status: 'error', error: 'No query specified' });
	var query = 'SELECT * FROM assists WHERE Club = ' + "'" + club + "' AND Pos = " + "'" + pos + "' ORDER BY A DESC";

	var key = club + pos;
	console.log('Club: ', club, 'Pos: ', pos);
	console.log('Built Query: ', query);
	memcached.get(key, function(err, data) {
		console.log('Data found in cache: ', data);
		if (!data) {
			connection.query(query, function(err, results) {
				if (err) throw error;
				var response = {};
				// Compute average assists
				var avg = 0;
				for (var i = 0; i < results.length; i++) {
					avg += results[i].A;
				}
				avg /= results.length;

				var tie = 0;
				response = {
					club: results[tie].Club,
					pos: results[tie].POS,
					max_assists: results[tie].A,
					player: results[tie].Player,
					avg_assists: avg
				};

				if (results.length > 1) {
					var tieBreaker = {};
					// Insert players into dictionary based on assists
					const dict = {};
					// Create key value pair with num assists as Key
					for (var i = 0; i < results.length; i++) {
						dict[results[i].A] = new Array();
					}
					// Insert players into dict based on Assist numbers
					for (var i = 0; i < results.length; i++) {
						dict[results[i].A].push(results[i]);
					}
					// Check for highest key
					function getMax(obj) {
						return Math.max.apply(null, Object.keys(obj));
					}
					var maxKey = getMax(dict);
					// Iterate through array with highest key to find player with most GS
					var tiedPlayers = dict[maxKey];
					var goalsScored = -1;
					for (var i = 0; i < tiedPlayers.length; i++) {
						if (tiedPlayers[i].GS > goalsScored) {
							goalsScored = tiedPlayers[i].GS;
							tieBreaker = tiedPlayers[i];
						}
					}

					// Player to return
					console.log(tieBreaker);
					response = {
						club: tieBreaker.Club,
						pos: tieBreaker.POS,
						max_assists: tieBreaker.A,
						player: tieBreaker.Player,
						avg_assists: avg
					};
				}

				// cache the results
				memcached.set(key, response, 10, function(err) {
					if (err) console.log(err);
				});
				res.send(response);
			});
		} else {
			res.send(data);
		}
	});
});

app.listen(3000, (req, res, next) => {
	console.log('Server Started...');
});
