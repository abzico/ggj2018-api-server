var bodyParser = require('body-parser');
var util = require('../util/util.js');
var constants = require('../core/constants.js');
var config = require('../core/config.js');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(config.dbPath);
var request = require('../net/request.js');
const mpauthx = require('mpauthx')(process.env.APPID, process.env.APPSECRET, process.env.SKU, db, process.env.REDISPASS);

/**
 * Get current timestamp.
 * @return {Number} Return the number of milliseconds since 1970/01/01
 */
function getTimestamp() {
	return Date.now();
}

module.exports = function(app) {
	// these lines need to be here to support parsing sending in data
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	// enable case sensitive url
	app.set('case sensitive routing', true);

	/**
	 * Now it makes use of our in-house mpauthx module :) from 143 lines to 7 lines.
	 * 
	 * Required to have code + encryptedData + iv.
	 * 1. It make a request online using input from appId + appSecret + code to get sessionKey and openId for checking against later.
	 * 2. It will extract openId from those input offline using appId + sessionKey + encryptedData + iv.
	 * 3. Check whether two openId matches, if not response with error. Otherwise continue.
	 * 4. Then it checks first whether such openId is already granted with access token in redis db.
	 * 		- If so, then it doesn't expire yet, it will immediately return that token back as response.
	 *   	- Otherwise, it checks against user table in sqlite3 db whether or not to register user as a new record.
	 *   		- Exists, then generate token and insert into redis db. Finally return token as reponse.
	 *   		- Not exist, register such user in sqlite3 db + generate token in redis db. Finally return token back as response.
	 *
	 * Return access token as string if conditions met, otherwise nothing but with error code.
	 */
	app.post(config.baseURL + '/authorize', function(req, res) {

		mpauthx.authorize(req.body.code, req.body.encryptedData, req.body.iv)
			.then((_res) => {
				console.log('response from /authorize', _res);
				res.send(util.createResponseMessage(_res.status_code, _res.status_message, _res.response));
			})
			.catch((_err) => {
				console.log(_err);
				res.send(util.createResponseMessage(_err.code, _err.message));
			});
	});

	// ----------------------------
  // -- API - GET /dummy
  // Just temporary return all nickNames of all users found in user table.
	// header param - constants.headerKey.userToken - string
	app.get(config.baseURL + '/dummy', function(req, res) {

		var successFunc = function() {
			// result to response back
			var retArr = [];

			db.each('select nickName from user', function(e, row) {
				if (e) {
					res.send(util.createResponseMessage(constants.statusCode.databaseRelatedError, `Error: ${e.message}`));
				}
				else {
					retArr.push(row);
				}
			}, function() {
				res.send(util.createResponseMessage(constants.statusCode.success, 'OK', retArr));
			});
		};

		// check if token is valid
		mpauthx.isTokenValid(req.get(constants.headerKey.userToken))
			.then(successFunc)
			.catch(function() {
				console.log('GET /dummy invalid token');
				res.send(util.createResponseMessage(constants.statusCode.invalidAccessToken, 'Invalid access token'));
				return;
			});
  });
  
  // ----------------------------
	// --- API - POST /updateUserInfo --
	// It will automatically extract open id to use in finding an exact user in user table.
	// Parameters doesn't necessary need to be sorted.
	// 
	// User should be gaining access to the app thus openId is there in user table already. Use this API to update
	// user's info later. User's info is not critical to have.
	// 
	// header param - constants.headerKey.userToken - string
	// param - city (string) - [optional] city
	// param - country (string) - [optional] country
	// param - gender (number) - [optional] gender of user (according to WeChat)
	// param - language (string) - [optional] language
	// param - nickName (string) - [optional] nick name
	// param - province (string) - [optional] province
	app.post(config.baseURL + '/updateUserInfo', function(req, res) {
		// all of body data input are optional

		// get token
		var token = req.get(constants.headerKey.userToken);
		console.log('token: ' + token);
		// check if token is valid
		mpauthx.isTokenValid(token)
			.then(function() {
				// get user's openId from userToken
				var openId = mpauthx.extractOpenId(token);
				// get time stamp of creation
				var timeStamp = getTimestamp();

				// run through all input values to create sql statement to update
				var columns = ['city', 'country', 'gender', 'language', 'nickName', 'province'];
				var values = [req.body.city, req.body.country, req.body.gender, req.body.language, req.body.nickName, req.body.province];
				var sql = 'update user set ';
				for (var i=0; i<values.length; i++) {
					var val = values[i];
					if (val != null && val != '') {
						// number data type
						if (i == 2) {
							sql += `${columns[i]}=${values[i]},`;
						}
						// string type
						else {
							sql += `${columns[i]}='${values[i]}',`;
						}
					}
				}
				// remove last comma
				sql = sql.substring(0, sql.length-1) + ` where openId='${openId}'`;

				// all is ok
				db.run(sql, function(e) {
					if (e) {
						res.send(util.createResponseMessage(constants.statusCode.databaseRelatedError, `Error: ${e.message}`));
					}
					else {
						res.send(util.createResponseMessage(constants.statusCode.success, 'OK'));
					}
				});
			})
			.catch(function() {
				console.log('POST /updateUserInfo invalid token');
				res.send(util.createResponseMessage(constants.statusCode.invalidAccessToken, 'Invalid access token'));
				return;
			});
	});

	return {
		// close resource it handles
		close: function() {
			if (mpauthx) {
				mpauthx.close();
			}
			db.close();
		}
	};
}