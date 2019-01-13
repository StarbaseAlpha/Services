'use strict';

function Services(settings={}) {

  // Settings
  const {servicesURL, dbName, system, appName, starbase} = settings;

  // Simple, Platform System, or Platform App?
  let servicesType = servicesURL;
  if (system) {
    servicesType = servicesURL + '/system';
  }
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
  const auth = starbase.Auth(Client(servicesType + '/auth'), db);

  // Starbase User Profiles
  const profiles = starbase.Profiles(starbase.Client(servicesType + '/profiles'), auth);

  // Starbase Database Admin
  const admin = starbase.Admin(starbase.Client(servicesType + '/admin'), auth);

  // YAY!
  return {db, auth, profiles, admin, starbase};

}
