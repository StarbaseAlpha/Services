'use strict';

const Starfire = require('@starbase/starfire');
const DBService = require('@starbase/database/dbservice');
const Channels = require('@starbase/channels');
const Auth = require('@starbase/auth');
const Profiles = require('@starbase/profiles');
const Admin = require('@starbase/admin');
const theRules = require('@starbase/therules');
const Functions = require('@starbase/functions');
const express = require('express');

const path = require('path');
const client = require(__dirname + path.sep + 'client');

function Services(settings={}) {

  let {firestore, systemPath, systemSecret, servicesPath, servicesSecret} = settings;

  if (!settings || typeof settings !== 'object') {
    throw('Error: The settings object is required.');
  }

  if (settings.client) {
    return client;
  }

  if (!settings.systemSecret) {
    throw('Error: The settings.systemSecret parameter is required.');
  }

  if (!settings.systemPath) {
    throw('Error: The settings.systemPath parameter is required.');
  }

  if (!settings.servicesPath) {
    throw('Error: The settings.servicesPath parameter is required.');
  }

  const starbase = {
    "Auth":Auth,
    "Profiles":Profiles,
    "Admin":Admin,
    "theRules":theRules
  };
  const functions = Functions();

  systemPath = systemPath.toString();
  systemSecret = systemSecret.toString();
  servicesPath = servicesPath.toString();
  servicesSecret = (servicesSecret || systemSecret + "SERVICES").toString();

  let getDB;
  if (firestore) {
    getDB = (path) => {
      return Starfire(firestore, path);
    };
  } else {
    let dbservice = DBService({});
    getDB = (path, keepalive=false) => {
      return dbservice.getDB(path,{"keepalive":keepalive});
    };
  }

  let system = {};
  system.starbase = starbase;
  system.database = getDB(systemPath,true);
  system.db = Channels(system.database);
  system.auth = Auth(system.db, systemSecret,{"refreshTokenExpires":1000 * 60 * 60 * 24 * 365 * 5});
  system.profiles = Profiles(system.db, system.auth);
  system.admin = Admin(system.db, system.auth);
  system.functions = Functions();

  const getService = async (appName=null) => {
    return await system.db.path('profiles').path((appName||"").toString()).get().then(async result => {
      let database = getDB(servicesPath + '/' + appName);
      let service = {};
      let db = Channels(database);
      let auth = Auth(db, appName + servicesSecret);
      service.auth = auth;
      service.db = db;
      service.database = Admin(db, system.auth, {"adminUser": appName}); 
      service.profiles = Profiles(db, auth);
      service.admin = Admin(db, auth);
      service.functions = await FunctionsExpress({
        "db":db, "auth": service.auth, "theRules": theRules, "starbase": starbase
      });
      return service;
    }).catch(err => {
      return null;
    });
  };

  const FunctionsExpress = async (env) => {
    let express = () => {
      return async (req, res) => {
        let func = await env.db.path('functions').path(req.params.name).get().then(result => {
          return result.data||{};
        }).catch(err => {
          return null;
        });
        let {code, options} = func;
        if (!code) {
          return res.status(404).json({"code":404, "message":"Function Not Found."});
        }
        let env = {"db":system.db, "auth":system.auth, "theRules":theRules};
        functions.express(code, env, options||{})(req, res);
      };
    }
    return {express};
  };

  const router = express.Router();

  router.use('/system/auth', system.auth.express());
  router.use('/system/profiles', system.profiles.express());
  router.use('/system/admin', system.admin.express());
  router.use('/system/functions', async (req, res) => {
    let functions = await FunctionsExpress({
      "db": system.db, "auth": system.auth, "theRules": theRules, "starbase": starbase
    });
    functions.express()(req, res);
  });

  router.use('/apps/:appName/database', async (req, res) => {
    let service = await getService(req.params.appName);
    if (service) {
      service.database.express()(req, res);
    } else {
      res.status(404).json({"code":404, "message":"Service Not Found"});
    }
  });

  router.use('/apps/:appName/auth', async (req, res) => {
    let service = await getService(req.params.appName);
    if (service) {
      service.auth.express()(req, res);
    } else {
      res.status(404).json({"code":404, "message":"Service Not Found"});
    }
  });

  router.use('/apps/:appName/profiles', async (req, res) => {
    let service = await getService(req.params.appName);
    if (service) {
      service.profiles.express()(req, res);
    } else {
      res.status(404).json({"code":404, "message":"Service Not Found"});
    }
  });

  router.use('/apps/:appName/admin', async (req, res) => {
    let service = await getService(req.params.appName);
    if (service) {
      service.admin.express()(req, res);
    } else {
      res.status(404).json({"code":404, "message":"Service Not Found"});
    }
  });

  router.use('/apps/:appName/functions/:name', async (req, res) => {
    let service = await getService(req.params.appName);
    if (service) {
      service.functions.express()(req, res);
    } else {
      res.status(404).json({"code":404, "message":"Service Not Found"});
    }
  });

  return {
    "system": system,
    "getService":getService,
    "express": () => {
      return router;
    }
  };

}

module.exports = Services;
