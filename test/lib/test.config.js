'use strict';

class SetupTestConfigComponent {

  constructor( deps ) {

    this._nconf = deps.inject( 'config' );

  }

  init( done ) {

    this._nconf.defaults( {
      stringstack: {
        express: SetupTestConfigComponent.defaultConfig
      }
    } );

    done();

  }

}

SetupTestConfigComponent.defaultConfig = {
  http: {
    enabled: true
  },
  https: {
    enabled: true
  }
};

module.exports = SetupTestConfigComponent;
