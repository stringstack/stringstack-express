'use strict';

class SetupTestConfigComponent {

  constructor( deps ) {

    this._nconf = deps.get( 'config' );

    this._nconf.defaults( {
      stringstack: {
        express: SetupTestConfigComponent.defaultConfig
      }
    } );

  }

  init( done ) {

    done();

  }

  dinit( done ) {

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
