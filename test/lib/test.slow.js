'use strict';

/**
 * This component sets up express to echo every response with a delay according to the delay header
 */

class TestEchoComponent {

  constructor( deps ) {

    let express = deps.get( './index' );

    if ( !express ) {
      throw new Error( "can't get express component" );
    }

    let app = express.getApp();

    // echo all requests
    app.use( ( req, res ) => {

      let response = {};

      let delay = req.headers.delay;

      if ( typeof delay === 'string' && delay.match( /^[0-9]+$/ ) ) {
        delay = parseInt( delay );
      } else {
        delay = 0;
      }

      response.method = req.method;
      response.url = req.url;
      response.headers = req.headers;
      response.httpVersionMajor = req.httpVersionMajor;
      response.httpVersionMinor = req.httpVersionMinor;
      response.httpVersion = req.httpVersion;
      response.body = req.body;
      response.query = req.query;
      response.cookies = req.cookies;
      response.remoteAddress = req.connection.remoteAddress;
      response.remotePort = req.connection.remotePort;
      response.delay = delay;

      setTimeout( () => {
        res.json( response );
      }, delay );

    } );

  }

  init( done ) {
    done();
  }

  dinit( done ) {
    done();
  }

}

module.exports = TestEchoComponent;
