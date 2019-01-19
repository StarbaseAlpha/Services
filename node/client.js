'use strict';

const Client = require('@starbase/client');

function ServicesClient(servicesURL, appName, token=null) {

  let setToken = (newToken=null) => {
    token = newToken || null;
  };

  let getToken = async () => {
    let refreshToken = async (token) => {
      return await Client(servicesURL + '/auth').request({
        "path":"/",
        "method":"refreshToken",
        "data":{"refreshToken":token.refreshToken}
      }).catch(err=>{return null;});
    };
    if (token && token.accessExpires && token.accessExpires > Date.now()) {
      return token.accessToken;
    }
    if (token && token.refreshToken) {
      return refreshToken(token).then(result=>{
        token = result;
        return token.accessToken;
      }).catch(err=>{return null;});
    }
    return null;
    };

    let apiURL = servicesURL;
    if (appName && typeof appName === 'string') {
      apiURL = apiURL + '/apps/' + appName;
    }
    let db = Client(apiURL + '/database');
    db.setTokenHandler(getToken);
    let auth = Client(apiURL + '/auth');

    let verifyUser = async (token=null) => {
      return await auth.request({
        "path":"/",
        "method":"verifyToken",
        "data":token
      }).then(result=>{return result.user||null;}).catch(err=>{return null;});
    };

    return {"db":db, "verifyUser":verifyUser, "setToken":setToken, "getToken":getToken};

}

module.exports = ServicesClient;
