'use strict';

// to enable these logs set `DEBUG=boot:02-load-users` or `DEBUG=boot:*`
var log = require('debug')('boot:02-load-users');

module.exports = function(app) {

  createDefaultUsers();

  function createDefaultUsers() {

    log('Creating roles and users');

    var User = app.models.User;

    var users = [];
    var roles = [{
      name: 'admin',
      users: [{
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@admin.com',
        username: 'poketests42',
        password: 'piripe'
      }]
    }, {
      name: 'users',
      users: [{
        firstName: 'Guest',
        lastName: 'User',
        email: 'user@user.com',
        username: 'user',
        password: 'user'
      }]
    }];

    roles.forEach(function(role) {
      role.users.forEach(function(roleUser) {
        User.findOrCreate({
            where: {
              username: roleUser.username
            }
          }, // find
          roleUser, // create
          function(err, createdUser, created) {
            if (err) {
              console.error('error creating roleUser', err);
            }
            (created) ? log('created user', createdUser.username): log('found user', createdUser.username);
          });
      });
    });
    return users;
  }

};
