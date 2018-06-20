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

  // the first check is evaluated in-line, no need to track it, thus we only have second and third checks out here

  let checkSecond = {
    onComplete: null,
    results: []
  };

  let checkThirdResult = {
    onComplete: null,
    response: null,
    body: null,
    err: null
  };

  let callCount = 50; // how many first and second checks to run

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

      // run these before we start the shutdown and let them complete.
      // for keep-alive requests these should idle TCP connections
      async.times( callCount, ( n, done ) => {

        echoTestCheck( {
          port: secure ? SetupTestConfigComponent.defaultConfig.https.port : SetupTestConfigComponent.defaultConfig.http.port,
          secure: secure,
          agentOptions: { keepAlive: keepAlive },
          headers: {
            delay: 0
          }
        } )( ( err ) => {

          if ( err ) {
            return done( err );
          }

          done();

        } );

      }, done );

    },
    ( done ) => {

      // run these before we start the shutdown and let them complete.
      // for any kind of requests these should active TCP connections
      async.times(
        callCount,
        ( n, done ) => {

          echoTestCheck( {
            port: secure ? SetupTestConfigComponent.defaultConfig.https.port : SetupTestConfigComponent.defaultConfig.http.port,
            secure: secure,
            agentOptions: { keepAlive: keepAlive },
            headers: {
              delay: 250
            }
          } )( ( err, response, body ) => {

            // will check all this later
            checkSecond.results.push( {
              response: response,
              body: body,
              err: err
            } );

            done();

          } );

        },
        () => {

          if ( typeof checkSecond.onComplete === 'function' ) {
            let temp = checkSecond.onComplete;
            checkSecond.onComplete = null;
            temp();
          } else {
            checkSecond.onComplete = true;
          }

        } );

      setTimeout( done, 100 ); // give the request time to start, then move on to dinit

    },
    ( done ) => {
      try {
        app.dinit( done );

        // push to next execution block in JS process, allowing dinit() io to apply
        setImmediate( () => {

          // this check should fail, because it is issues after server shutdown, however the active calls in progress
          // should still return even though this one is blocked
          let check = echoTestCheck( {
            port: secure ? SetupTestConfigComponent.defaultConfig.https.port : SetupTestConfigComponent.defaultConfig.http.port,
            secure: secure,
            agentOptions: { keepAlive: keepAlive },
            headers: {
              delay: 0
            }
          } );

          check( ( err, response, body ) => {

            // will check these later
            checkThirdResult.err = err;
            checkThirdResult.response = response;
            checkThirdResult.body = body;

            if ( typeof checkThirdResult.onComplete === 'function' ) {
              let temp = checkThirdResult.onComplete;
              checkThirdResult.onComplete = null;
              temp();
            } else {
              checkThirdResult.onComplete = true;
            }

          } );

        } );

      } catch ( e ) {
        return done( e );
      }
    },
    ( done ) => {

      async.parallel( [
        ( done ) => {

          if ( checkSecond.onComplete ) {

            // in-progress calls have ended, move on now
            done();
          } else {

            // in-progress calls have not ended, fire the done callback as soon as they finish
            checkSecond.onComplete = done;
          }

        },
        ( done ) => {
          if ( checkThirdResult.onComplete ) {

            // in-progress calls have ended, move on now
            done();
          } else {

            // in-progress calls have not ended, fire the done callback as soon as they finish
            checkThirdResult.onComplete = done;
          }
        }
      ], done );

    },
    ( done ) => {

      //  app has finished dinit, and all second and third
      try {

        // check the results of all the requests that were in-progress when dinit fired
        checkSecond.results.forEach( ( result ) => {

          // console.log( 'result.body 2', result.body );

          assert.ifError( result.err, 'should be no error on check request' );
          assert( !!result.response, 'First response should exist' );
          assert( !!result.body, 'First body should exist' );

        } );

        // check the result of the request that was made slightly after dinit fired
        if ( !checkThirdResult.err ||
             typeof checkThirdResult.err.message !== 'string' ||
             !checkThirdResult.err.message.match( /ECONNREFUSED/ ) ) {
          assert.fail( 'second check should fail since it is started after server dinit is called: ' + checkThirdResult.err.message );
        }
        assert( !checkThirdResult.response, 'Second response should be false' );
        assert( !checkThirdResult.body, 'Second body should be false' );

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

        // shutdown should be fast
        this.timeout( 1000 );

        generateShutdownCheck( true, false, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTP non-keep-alive connections to close before exiting',
      function ( done ) {

        // shutdown should be fast
        this.timeout( 1000 );

        generateShutdownCheck( false, false, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTPS keep-alive connections to close before exiting',
      function ( done ) {

        // shutdown should be fast
        this.timeout( 1000 );

        generateShutdownCheck( true, true, done );

      } );

    it( 'on shutdown, should stop new connections and wait for HTTPS non-keep-alive connections to close before exiting',
      function ( done ) {

        // shutdown should be fast
        this.timeout( 1000 );

        generateShutdownCheck( false, true, done );

      } );


  } );
} );