# StringStack Express

StringStack/express is a component container for ExpressJS that allows you to easily include the ExpressJS framework in 
your StringStack application. The goal of this component is as follows:

* Map StringStack init/dinit patterns to [ExpressJS](https://www.npmjs.com/package/express).
* Provide graceful startup/shutdown via [Stoppable](https://www.npmjs.com/package/stoppable).
* Have ZERO interference between your routes and [ExpressJS](https://www.npmjs.com/package/express). 

# Migrating from 0.1.x to 0.2.x

Although the APIs for 0.1.x and 0.2.x are compatible, logging mentality has changed. In 0.1.x all HTTP/S requests were 
passed to the StringStack logger component. In order to do this requests and responses had to be tracked with a 
middleware. This was contrary to our goal of having zero interference between your routes and express. Even if you didn't
enable the debug logging level, the effort was still made behind the scenes to create the log entry even if your log
facility ignored the entry.

If you would like to recreate this logging in your code, simply add this middleware in one of your route components, 
before all other middleware or route handlers:

```javascript

    
    this._logger = deps.get( 'logger' );
    this._app = deps.get( '@stringstack/express' ).getApp();

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

``` 

New logging was also added for confirming what ports are being opened, when the ports are open, which servers are 
closing, and finally confirming when each server has been closed.

# Installation

```bash
npm install @stringstack/express --save
```

This will also install ExpressJS for you. See the version log at the end of this document to see which version of 
ExpressJS is provided with each version of StringStack/express. 

# Configuration

StringStack/express looks for configuration in the nconf container provided by 
[StringStack](https://www.npmjs.com/package/stringstack). Store the configuration in nconf at the path 
```stringstack:express```. The configuration is an object of the following schema.

```json
{
  "http": {
    "enabled": true,
    "port": 8080
  },
  "https": {
    "enabled": false,
    "port": 8443,
    "options": {
      "key": "",
      "cert": ""
    }
  }
}
``` 

```text
http.enabled: <boolean> indicates whether to create an HTTP listener. Default: false
http.port: <integer> Ignored if http.enabled is false. The port to listen on for HTTP. Default: 8080
```

```text
https.enabled: <boolean> indicates whether to create an HTTPS listener. Default: false
https.port: <integer> Ignored if https.enabled is false. The port to listen on for HTTPS. Default: 8443
https.options: <object> This field is passed directly to the NodeJS https.createServer() method. See 
https://nodejs.org/en/docs/ for configuration options. The default config has self-signed certs so you can get going 
quickly with TLS, but these should NOT be used in production.
```

The best way to set the config would be to create a config setup component and pass it to rootComponents when creating 
the App instance. See [StringStack](https://www.npmjs.com/package/stringstack) documentation for examples of setting 
rootComponents.

You would use the setup component to set all config values for your entire StringStack app. 

An example setup component.

```javascript

class SetupComponent {
  
  constructor( deps ) {
    this._nconf = deps.get( 'config' );
  }
  
  init( done ) {
    
    asynchronousLoadExpressConfigFromFileServerWhatever( ( err, config ) => {
      
      if (err) {
        return done( err );
      }
      
      this._nconf.defaults({
        stringstack: {
          express: config
        }
      });
      
    } );
    
  }
  
  dinit( done ) {
    done();
  }
  
}

module.exports = SetupComponent;

``` 

# Usage

The StringStack/express component is a minimal wrapper around ExpressJS. The component simply adds the hooks to start 
and stop the listeners in a sane manner. It also utilizes https://www.npmjs.com/package/stoppable to ensure web 
services start and stop in a predictable manner. See the documentation on stoppable for details.

In order to access ExpressJS and add your custom configuration, you will need to create your own component that 
configures ExpressJS. Here is an example component that will configure ExpressJS to echo back any request made. 

```javascript
class MyExpressEchoRouteSetupComponent {
 
  constructor( deps ) {
 
    // use inject instead of get to ensure that this component inits before stringstack/express opens ports.
    this._express = deps.inject( '@stringstack/express' );
 
  }
 
  init( done ) {

    // getApp() returns the result of express(). However, getApp() always returns the same instance of express().
    let app = this._express.getApp();
 
    // setup a route to echo all requests
    app.use( ( req, res ) => {
 
      let response = {};
 
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
 
      res.json( response );
 
    } );


    done();
  }
 
  dinit( done ) {
    done();
  }
 
}
 
module.exports = MyExpressEchoRouteSetupComponent;
```

Here we see that the ExpressJS component has a method getApp(). This allows the component 
MyExpressEchoRouteSetupComponent to register all of its configuration and routes before the ExpressJS component starts 
listening.

ExpressJS won't start listening for requests until MyExpressEchoRouteSetupComponent.init() is called and calls done().

Setup as many route components as needed, or one giant route component. Multiple components helps organize code, but it
may not be clear which routes create in what order. If your API is 

# Logging

These are the events that are logged, including the log level used.

* info: `opening http/s on port <port number>` # logged when attempting to open the specified port for specified server
* info: `http/s listening on port <port number>` # logged when server is accepting requests on specified port
* info: `stopping http/s` # logged when stopping specified server, inflight requests may be in progress buy no new
requests can be accepted. Any reverse proxies will see the inbound port as closed and may start draining traffic.
* info: `stopping http/s` # logged when the server has no more connections and is completely shutdown. 

# Security

This component is made to be VERY lean. Web servers are very dynamic tools and the valid use cases for how to use them
are across the board. Web server security is also one of those things that has numerous valid use cases. As such this
component does not attempt to enforce any security semantics beyond those built in to NodeJS itself and ExpressJS.

Any security flags you wish to set or unset is up to you. The only explicit configuration exposed for security is the
options field for an HTTPS listener. Other than that, security is on you, just like it is with raw ExpressJS.

# Version Log

This is a log of which version of ExpressJS is provided by each version of StringStack/express.

* @stringstack/express@0.2.0 => express@4.17.1
* @stringstack/express@0.1.2 => express@4.16.4
* @stringstack/express@0.0.1 => express@4.16.3
