'use strict';

const __ = require( 'doublescore' );
const async = require( 'async' );
const express = require( 'express' );
const fs = require( 'fs' );
const http = require( 'http' );
const https = require( 'https' );
const stoppable = require( './lib/stoppable' );

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

    let requestId = 0;

    this._app.use( ( req, res, next ) => {

      requestId++;

      // reset counter at a billion. if your process handles this many requests without a restart, you don't release
      // often enough.
      if ( requestId > 1000000000 ) {
        requestId = 1;
      }

      let entry = {
        requestId: requestId,
        request: {
          protocol: typeof req.protocol === 'string' ? req.protocol.toLowerCase() : null,
          hostname: typeof req.hostname === 'string' ? req.hostname.toLowerCase() : null,
          path: typeof req.path === 'string' ? req.path : null,
          method: typeof req.method === 'string' ? req.method.toLowerCase() : null,
          secure: req.secure,
          headers: req.headers,
          ip: req.ip,
          ips: req.ips,
          query: req.query || {},
          cookies: null
        },
        response: {
          headers: {},
          statusCode: null
        }
      };

      let ips = entry.request.ips.length > 0 ? entry.request.ips : [ entry.request.ip ];

      let message = `START [${entry.requestId}] ${entry.request.protocol} ${entry.request.method}: ${entry.request.hostname}: ${entry.request.path}: ${JSON.stringify(
        ips )}`;
      this._logger( 'debug', message, entry );

      res.once( 'finish', () => {

        setImmediate( () => {

          // if a user supplied middleware parses body or cookies, add it to the log
          entry.request.cookies = req.cookies || null;
          entry.request.body = req.body || null;

          // manually pull headers because getHeaders() does not return a plain Object instance
          entry.response.headers = {};
          res.getHeaderNames().forEach( ( header ) => {
            entry.response.headers[ header ] = res.getHeader( header );
          } );

          entry.response.statusCode = res.statusCode || null;

          let message = `FINISH [${entry.requestId}] ${entry.request.protocol} ${entry.request.method}: ${entry.request.hostname}: ${entry.request.path}: ${JSON.stringify(
            ips )}`;
          this._logger( 'debug', message, entry );

        } );

      } );

      next();

    } );

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

        server.listen( config.http.port, done );

        this._http = server;

      } );

    }

    if ( config.https && config.https.enabled ) {

      serversTasks.push( ( done ) => {

        let server = https.createServer( config.https.options, this._app );

        server.keepAliveTimeout = keepAliveTimeout;

        server = stoppable( server, 30000 );

        server.listen( config.https.port, done );

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
        http.stop( done );
      } );

    }

    if ( this._https ) {

      let https = this._https;
      this._https = null;

      serversTasks.push( ( done ) => {
        https.stop( done );
      } );

    }

    async.parallel( serversTasks, done );

  }

}

module.exports = ExpressJSComponent;
