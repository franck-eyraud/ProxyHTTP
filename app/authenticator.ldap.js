module.exports = function() {

  var LDAP = require('ldapjs');
  var CRYPTO = require ('crypto');

  var cache = {
    set: function(url, id, err) {
      console.log('CACHE set');
      if (!this[url]) {
        this[url] = {};
      }
      this[url][id] = {
        success: !err,
        timeOut: setTimeout(this.remove, err? 300000:900000, url, id)
      };
    },
    get: function(url, id) {
      console.log('CACHE got');
      return this[url]? this[url][id] : null;
    },
    remove: function(url, id) {
      if (this[url]) {
        console.log('CACHE removed');
        delete this[url][id];
        if (this[url]==={}) {
          delete this[url];
        }
      }
    }
  };

  return function(context, settings, callback) {
    var request = context.requestIn;
    var url = settings.url;
    var ldapReq = settings.id + '=' + request.auth.login + ',' + settings.dn;
    var id = CRYPTO.createHash('sha1')
      .update(url)
      .update(ldapReq)
      .update(request.auth.password || "")
      .digest('hex');
    var cachedValue = cache.get(url, id);
    if (cachedValue) {
      request.auth.success = cachedValue.success;
      callback(true);
    } else {
      var ldap = LDAP.createClient({url: url});
      ldap.search(ldapReq, {}, function(err, res) {
        if (err) { // network error
          callback(false);
        } else {
          res.on('error', function(err) { // ldap error including 'not found'
            callback(false);
          });
          res.on('searchEntry', function() {
            ldap.bind(ldapReq, request.auth.password, function(err) {
              request.auth.success = !err;
              cache.set(url, id, err);
              if (!err) {
                ldap.unbind();
              }
              callback(true);
            });
          });
        }
      });
    }
  };

}();
