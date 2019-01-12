'use strict';

const Client = require('@starbase/client');

function ServicesClient(servicesURL, appName, token=null) {

  let setToken = (newToken=null) => {
    token = newToken || null;
  };

  let getToken = async () => {
    let refreshToken = async (token) => {
      return await Client(servicesURL + '/system/auth').request({
        "path":"/",
        "method":"refreshToken",
        "data":{"refreshToken":token.refreshToken}
      }).catch(err=>{return null;});
    };
    if (token && token.accessExpires && token.accessExpires > Date.now()) {
      return token.accessToken;
    }
    if (token && token.refreshExpires && token.refreshToken && token.refreshExpires > Date.now()) {
      return refreshToken(token).then(result=>{
        token = result;
        return token.accessToken;
      }).catch(err=>{return null;});
    }
    if (token && token.refreshExpires && token.refreshExpires < Date.now()) {
      return null;
    }
    return null;
    };

    let db = Client(servicesURL + '/apps/' + appName + '/database');
    db.setTokenHandler(getToken);
    let auth = Client(servicesURL + '/apps/' + appName + '/auth');

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
