'use strict';

function Services(starbase = {}, servicesURL = null, dbName = null, appName = null) {

  // System or App?
  let servicesType = servicesURL + '/system';
  if (appName) {
    servicesType = servicesURL + '/apps/' + appName.toString();
  }

  // Starbase Libraries
  const Database = starbase.Database;
  const Channels = starbase.Channels;
  const Client = starbase.Client;
  const Auth = starbase.Auth;
  const Profiles = starbase.Profiles;
  const Admin = starbase.Admin;

  // Local Channels Database
  const database = Database(dbName);
  const db = Channels(database);

  // Starbase Authentication
  const auth = Auth(Client(servicesType + '/auth'), db);

  // Starbase User Profiles
  const profiles = Profiles(Client(servicesType + '/profiles'), auth);

  // Starbase Database Admin
  const admin = Admin(Client(servicesType + '/admin'), auth);

  // YAY!
  return {db, auth, profiles, admin};

}
