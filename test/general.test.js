'use strict';

const assert = require( 'assert' );
const async = require( 'async' );
const request = require( 'request' );
const SetupTestConfigComponent = require( './lib/test.config' );
const StringStackCore = require( '@stringstack/core' );

let getComponentNative = function ( app, targetPath ) {
  return app._loader.get( 'app', targetPath );
};

let echoTestCheck = function ( params ) {

  let port = params.port;
  let secure = params.secure || false;
  let agentOptions = params.agentOptions || {};
  let headers = params.headers || {};
  let method = params.method || 'GET';

  return function ( done ) {

    if ( secure ) {
      agentOptions.rejectUnauthorized = false; // allow self-signed certs. We have no signed certs in tests
    }

    async.waterfall( [
      ( done ) => {

        let url = 'http' + (secure ? 's' : '') + '://localhost:' + port + '/test';

        request( {
          url: url,
          method: method,
          headers: headers,
          agentOptions: agentOptions
        }, done );

      },
      ( response, body, done ) => {

        try {

          assert( !!response, 'Response should exist' );
          assert( typeof body === 'string', 'Body should be string' );

          body = JSON.parse( body );

          assert.equal( body.method, method );
          assert.equal( body.url, '/test' );

        } catch ( e ) {
          return done( e );
        }

        done( null, response, body );
      }
    ], done );

  };

};

let generateShutdownCheck = function ( keepAlive, secure, done ) {

  let app = null;

  let checkFirstResult = {
    onComplete: null,
    response: null,
    body: null,
    err: null
  };

  let checkSecondResult = {
    response: null,
    body: null,
    err: null
  };

  async.series( [
    ( done ) => {

      SetupTestConfigComponent.defaultConfig = {
        http: {
          enabled: !secure,
          port: 8080
        },
        https: {
          enabled: secure,
          port: 8443
        }
      };

      try {

        let core = new StringStackCore();

        const App = core.createApp( {
          rootComponents: [
            './test/lib/test.config',
            './test/lib/test.slow'
          ]
        } );

        app = new App( 'test' );

        done();

      } catch ( e ) {
        return done( e );
      }

    },
    ( done ) => {
      try {
        app.init( done );
      } catch ( e ) {
        return done( e );
      }
    },
    ( done ) => {

      let check = echoTestCheck( {
        port: secure ? SetupTestConfigComponent.defaultConfig.https.port : SetupTestConfigComponent.defaultConfig.http.port,
        secure: secure,
        agentOptions: { keepAlive: keepAlive },
        headers: {
          delay: 250
        }
      } );

      check( ( err, response, body ) => {

        // console.log( 'check 1 err', err );
        // console.log( 'check 1 response', !!response );
        // console.log( 'check 1 body', !!body );

        checkFirstResult.err = err;
        checkFirstResult.response = response;
        checkFirstResult.body = body;

        if ( typeof checkFirstResult.complete === 'function' ) {
          let temp = checkFirstResult.complete;
          checkFirstResult.complete = null;
          temp();
        } else {
          checkFirstResult.complete = true;
        }

      } );

      setTimeout( done, 10 ); // give the request time to start

    },
    ( done ) => {
      try {
        app.dinit( done );

        setImmediate( () => {

          // this check should fail, because it is issues after server shutdown
          let check = echoTestCheck( {
            port: secure ? SetupTestConfigComponent.defaultConfig.https.port : SetupTestConfigComponent.defaultConfig.http.port,
            secure: secure,
            agentOptions: { keepAlive: keepAlive },
            headers: {
              delay: 0
            }
          } );

          check( ( err, response, body ) => {

            // console.log( 'check 2 err', err );
            // console.log( 'check 2 response', !!response );
            // console.log( 'check 2 body', !!body );

            checkSecondResult.err = err;
            checkSecondResult.response = response;
            checkSecondResult.body = body;

          } );

        } );

      } catch ( e ) {
        return done( e );
      }
    },
    ( done ) => {

      if ( checkFirstResult.complete ) {
        done();
      } else {
        checkFirstResult.complete = done;
      }

    },
    ( done ) => {

      // dinit should not fire callback until the request is complete

      // console.log( 'checkFirstResult.err', checkFirstResult.err );
      // console.log( 'checkFirstResult.response', !!checkFirstResult.response );
      // console.log( 'checkFirstResult.body', !!checkFirstResult.body );
      // console.log( 'checkSecondResult.err', checkSecondResult.err );
      // console.log( 'checkSecondResult.response', !!checkSecondResult.response );
      // console.log( 'checkSecondResult.body', !!checkSecondResult.body );

      try {

        assert.ifError( checkFirstResult.err, 'should be no error on check request' );
        assert( !!checkFirstResult.response, 'First response should exist' );
        assert( !!checkFirstResult.body, 'First body should exist' );

        if ( !checkSecondResult.err ||
             typeof checkSecondResult.err.message !== 'string' ||
             !checkSecondResult.err.message.match( /ECONNREFUSED/ ) ) {
          assert.fail( 'second check should fail since it is started after server dinit is called: ' + checkSecondResult.err.message );
        }
        assert( !checkSecondResult.response, 'Second response should be false' );
        assert( !checkSecondResult.body, 'Second body should be false' );

      } catch ( e ) {
        return done( e );
      }

      done();

    }
  ], done );

};

describe( 'general', function () {
  describe( 'express', function () {

    it( 'should instantiate, init and dinit', function ( done ) {

      let app = null;

      async.series( [
        ( done ) => {

          try {

            SetupTestConfigComponent.defaultConfig = {
              http: {
                enabled: false
              },
              https: {
                enabled: false
              }
            };

            let core = new StringStackCore();

            const App = core.createApp( {
              rootComponents: [
                './test/lib/test.config',
                './index'
              ]
            } );

            app = new App( 'test' );

            done();

          } catch ( e ) {
            return done( e );
          }

        },
        ( done ) => {
          try {
            app.init( done );
          } catch ( e ) {
            return done( e );
          }
        },
        ( done ) => {
          try {
            app.dinit( done );
          } catch ( e ) {
            return done( e );
          }
        }
      ], done );

    } );

    it( 'should listen on HTTP port', function ( done ) {

      let app = null;

      SetupTestConfigComponent.defaultConfig = {
        http: {
          enabled: true,
          port: 8080
        },
        https: {
          enabled: false
        }
      };

      async.series( [
        ( done ) => {

          try {

            let core = new StringStackCore();

            const App = core.createApp( {
              rootComponents: [
                './test/lib/test.config',
                './test/lib/test.echo'
              ]
            } );

            app = new App( 'test' );

            done();

          } catch ( e ) {
            return done( e );
          }

        },
        ( done ) => {
          try {
            app.init( done );
          } catch ( e ) {
            return done( e );
          }
        },
        echoTestCheck( { port: SetupTestConfigComponent.defaultConfig.http.port, secure: false } )
      ], ( testErr ) => {

        try {
          app.dinit( ( dinitErr ) => {

            if ( testErr ) {
              return done( testErr );
            } else if ( dinitErr ) {
              return done( dinitErr );
            }

            done();

          } );
        } catch ( dinitErr ) {

          if ( testErr ) {
            return done( testErr );
          } else if ( dinitErr ) {
            return done( dinitErr );
          }

          done();
        }

      } );

    } );

    it( 'should listen on HTTPS port', function ( done ) {

      let app = null;

      SetupTestConfigComponent.defaultConfig = {
        http: {
          enabled: false
        },
        https: {
          enabled: true,
          port: 8444
        }
      };

      async.series( [
        ( done ) => {

          try {

            let core = new StringStackCore();

            const App = core.createApp( {
              rootComponents: [
                './test/lib/test.config',
                './test/lib/test.echo'
              ]
            } );

            app = new App( 'test' );

            done();

          } catch ( e ) {
            return done( e );
          }

        },
        ( done ) => {
          try {
            app.init( done );
          } catch ( e ) {
            return done( e );
          }
        },
        echoTestCheck( { port: SetupTestConfigComponent.defaultConfig.https.port, secure: true } )
      ], ( testErr ) => {

        try {
          app.dinit( ( dinitErr ) => {

            if ( testErr ) {
              return done( testErr );
            } else if ( dinitErr ) {
              return done( dinitErr );
            }

            done();

          } );
        } catch ( dinitErr ) {

          if ( testErr ) {
            return done( testErr );
          } else if ( dinitErr ) {
            return done( dinitErr );
          }

          done();
        }

      } );

    } );

    it( 'on shutdown, should stop new connections and wait for HTTP keep-alive connections to close before exiting',
      function ( done ) {

        // we test waiting for slow responses
        this.timeout( 200000 );

        generateShutdownCheck( true, false, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTP non-keep-alive connections to close before exiting',
      function ( done ) {

        // we test waiting for slow responses
        this.timeout( 200000 );

        generateShutdownCheck( false, false, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTPS keep-alive connections to close before exiting',
      function ( done ) {

        // we test waiting for slow responses
        this.timeout( 200000 );

        generateShutdownCheck( true, true, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTPS non-keep-alive connections to close before exiting',
      function ( done ) {

        // we test waiting for slow responses
        this.timeout( 200000 );

        generateShutdownCheck( false, true, done );

      } );


  } );
} );