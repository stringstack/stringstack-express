'use strict';

/**
 * This component sets up express to echo every response
 */

class TestEchoComponent {

  constructor( deps ) {

    let express = deps.get( './index' );

    if ( !express ) {
      throw new Error( 'can\'t get express component' );
    }

    let app = express.getApp();

    let handler = ( req, res ) => {

      let response = {};

      // console.log( 'req.url', req.url );

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
      response.delay = null;

      res.json( response );

    };

    // echo all requests
    app.get( '/echo', handler );
    app.post( '/echo', handler );
    app.put( '/echo', handler );
    app.delete( '/echo', handler );

  }

}

module.exports = TestEchoComponent;
