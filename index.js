'use strict';

const __ = require( 'doublescore' );
const async = require( 'async' );
const express = require( 'express' );
const fs = require( 'fs' );
const http = require( 'http' );
const https = require( 'https' );
const stoppable = require( 'stoppable' );

/**
 * Development TLS certificate should not be used in production.
 *
 * Your configs SHOULD override this for production.
 *
 * @type {{key: (String), cert: (String)}}
 */
let testTLS = {
  key: fs.existsSync( 'certs/test.key' ) ? fs.readFileSync( 'certs/test.key', 'utf8' ) : null,
  cert: fs.existsSync( 'certs/test.crt' ) ? fs.readFileSync( 'certs/test.crt', 'utf8' ) : null
};

let defaultConfig = {
  http: {
    enabled: false,
    port: 8080
  },
  https: {
    enabled: false,
    port: 8443,
    options: testTLS
  }
};

class ExpressJSComponent {

  constructor( deps ) {

    this._nconf = deps.get( 'config' );
    this._logger = deps.get( 'logger' );

    this._app = express();

  }

  getApp() {
    return this._app;
  }

  init( done ) {

    let nconfConfig = this._nconf.get( 'stringstack:express' );

    let config = __( defaultConfig ).mixin( nconfConfig );

    this._http = null;
    this._https = null;

    let keepAliveTimeout = 5000;

    let serversTasks = [];

    if ( config.http && config.http.enabled ) {

      serversTasks.push( ( done ) => {

        let server = http.createServer( this._app );

        server.keepAliveTimeout = keepAliveTimeout;

        server = stoppable( server, 30000 );

        this._logger( 'info', 'opening http on port ' + config.http.port );
        server.listen( config.http.port, ( err ) => {

          this._logger( 'info', 'http listening on port ' + config.http.port );
          done( err || null );

        } );

        this._http = server;

      } );

    }

    if ( config.https && config.https.enabled ) {

      serversTasks.push( ( done ) => {

        let server = https.createServer( config.https.options, this._app );

        server.keepAliveTimeout = keepAliveTimeout;

        server = stoppable( server, 30000 );

        this._logger( 'info', 'opening https on port ' + config.https.port );
        server.listen( config.https.port, ( err ) => {

          this._logger( 'info', 'https listening on port ' + config.https.port );
          done( err || null );

        } );

        this._https = server;

      } );

    }

    async.parallel( serversTasks, done );

  }

  dinit( done ) {

    let serversTasks = [];

    if ( this._http ) {

      let http = this._http;
      this._http = null;

      serversTasks.push( ( done ) => {
        this._logger( 'info', 'stopping http' );
        http.stop( ( err ) => {
          this._logger( 'info', 'http stopped' );
          done( err || null );
        } );
      } );

    }

    if ( this._https ) {

      let https = this._https;
      this._https = null;

      serversTasks.push( ( done ) => {
        this._logger( 'info', 'stopping https' );
        https.stop( ( err ) => {
          this._logger( 'info', 'https stopped' );
          done( err || null );
        } );
      } );

    }

    async.parallel( serversTasks, done );

  }

}

module.exports = ExpressJSComponent;
