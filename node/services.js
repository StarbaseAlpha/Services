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

  let {firestore, secret, dbPath} = settings;

  if (!settings || typeof settings !== 'object') {
    throw('Error: The settings object is required.');
  }

  if (settings.client) {
    return client;
  }

  if (!settings.secret) {
    throw('Error: The settings.secret parameter is required.');
  }

  if (!settings.dbPath) {
    throw('Error: The settings.dbPath parameter is required.');
  }

  const starbase = {
    "Auth":Auth,
    "Profiles":Profiles,
    "Admin":Admin,
    "theRules":theRules
  };

  const functions = Functions();
  const router = express.Router();

  dbPath = dbPath.toString();
  secret = secret.toString();
  dbPath = dbPath.toString();
  secret = (secret || secret + "SERVICES").toString();

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
  system.database = getDB(dbPath + '/system',true);
  system.db = Channels(system.database);
  system.auth = Auth(system.db, secret,{"refreshTokenExpires":1000 * 60 * 60 * 24 * 365 * 5});
  system.profiles = Profiles(system.db, system.auth);
  system.admin = Admin(system.db, system.auth);
  system.functions = Functions();

  const FunctionsExpress = (env) => {
    let serv = {};
    let {db, auth, theRules, starbase} = env;
    serv.express = () => {
      return async (req, res) => {
        let func = await db.path('functions').path(req.params.name).get().then(result => {
          return result.data||{};
        }).catch(err => {
          return {};
        });
        let {code, options} = func;
        if (!code) {
          return res.status(404).json({"code":404, "message":"Function Not Found."});
        }
        let env = {"db":db, "auth":auth, "theRules":theRules};
        Functions().express(code, env, options||{})(req, res);
      };
    }
    return serv;
  };

  if (!settings.platform) {

    router.use('/auth', system.auth.express());
    router.use('/profiles', system.profiles.express());
    router.use('/admin', system.admin.express());
    router.use('/functions/:name', async (req, res) => {
      let funcs = FunctionsExpress({
        "db": system.db, "auth": system.auth, "theRules": theRules, "starbase": starbase
      });
      funcs.express()(req, res);
    });

    return {
      "system": system,
      "express": () => {
        return router;
      }
    };

  }

  router.use('/system/auth', system.auth.express());
  router.use('/system/profiles', system.profiles.express());
  router.use('/system/admin', system.admin.express());
  router.use('/system/functions/:name', async (req, res) => {
    let funcs = FunctionsExpress({
      "db": system.db, "auth": system.auth, "theRules": theRules, "starbase": starbase
    });
    funcs.express()(req, res);
  });

  const getService = async (appName=null) => {
    return await system.db.path('/auth/users').path((appName||"").toString()).get().then(async result => {
      let database = getDB(dbPath + '/apps-' + appName);
      let service = {};
      let db = Channels(database);
      let auth = Auth(db, appName + secret);
      service.auth = auth;
      service.db = db;
      service.database = Admin(db, system.auth, {"adminUser": appName});
      service.profiles = Profiles(db, auth);
      service.admin = Admin(db, auth);
      service.functions = await FunctionsExpress({
        "db":db, "auth": auth, "theRules": theRules, "starbase": starbase
      });
      return service;
    }).catch(err => {
      return null;
    });
  };

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
