// private functions not expose to public
var _ = {
  degreesToRadians: function(deg) {
    return deg * (Math.PI / 180.0);
  },
  radiansToDegrees: function(rad) {
    return rad * (180.0 / Math.PI);
  }
}

module.exports = {
  /**
   * See http://www.movable-type.co.uk/scripts/latlong.html
   * It calculates distance between two location
   * 
   * Return distance in metres (m) between two locations.
   */
  getHaversineDistance: function (lat1, lon1, lat2, lon2) {
    var R = 6371e3; // metres
    var a1 = _.degreesToRadians(lat1);
    var a2 = _.degreesToRadians(lat2);
    var da = _.degreesToRadians(lat2 - lat1);
    var dte = _.degreesToRadians(lon2 - lon1);

    var a = Math.sin(da / 2) * Math.sin(da / 2) +
      Math.cos(a1) * Math.cos(a2) *
      Math.sin(dte / 2) * Math.sin(dte / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  /**
   * Create a response message message.
   *
   * Return message string ready to be sent over network.
   */
  createResponseMessage: function(statusCode, statusMessage, response=null) {
    return JSON.stringify({
      status_code: statusCode,
      status_message: statusMessage,
      response: response
    });
  },

  /**
   * Generate a random string with input length.
   * It will return null if length is less than or equal 0, or equal null, or not number type.
   */
  generateRandomString: function(length) {
    if (length <= 0 || length == null || typeof length !== 'number') return null;

    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }
}