# StringStack Express

StringStack/express is a component container for ExpressJS that allows you to easily include the ExpressJS framework in 
your StringStack application.

# Installation

```bash
npm install @stringstack/express --save
```

This will also install ExpressJS for you. See the version log at the end of this document to see which version of 
ExpressJS is provided with each version of StringStack/express. 

# Configuration

StringStack/express looks for configuration in the nconf container provided by StringStack/core. Store the configuration
in nconf at the path ```stringstack:express```. The configuration is an object of the following schema.

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

The best way to set the config would be to create a config setup component and pass it to rootComponents when creating the 
App instance. See https://www.npmjs.com/package/@stringstack/core documentation for examples of setting rootComponents.

You would use the setup component to set all config values for your entire StringStack app. 

An example setup component.

```javascript

class SetupComponent {
  
  constructor( deps ) {
    this._nconf = deps.get( 'config' );
  }
  
  init( done ) {
    
    asynchronousLoadExpressConfig( ( err, config ) => {
      
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
class ExpressJSEchoComponent {
 
  constructor( deps ) {
 
    let express = deps.get( '@stringstack/express' );
 
    if ( !express ) {
      throw new Error( "can't get express component" );
    }
 
    // getApp() returns the result of express(). However, getApp() always returns the same instance of express().
    let app = express.getApp();
 
    // echo all requests
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
 
  }
 
  init( done ) {
    done();
  }
 
  dinit( done ) {
    done();
  }
 
}
 
module.exports = ExpressJSEchoComponent;
```

Here we see that the ExpressJS component has a method getApp(), which can be called in the constructor. This allows the
component ExpressJSEchoComponent to register all of its configuration before the ExpressJS component starts listening.

Once ExpressJSEchoComponent.init() is called, ExpressJSEchoComponent can be sure that ExpressJS is listening and 
handling requests.

Note: It may not be apparent but there is a side effect to the current ExpressJS pattern. Because we need to include
StringStack/express in the constructor for ExpressJSEchoComponent in order to access the getApp() method, this means
that StringStack/express.init() will be called before ExpressJSEchoComponent.init(). This means that 
ExpressJSEchoComponent must setup express before any asynchronous config is available. Thus, if your application 
requires dynamic ExpressJS setup based on config, and configs are not available synchronously in the constructor, you
will need to find a workaround for your ExpressJS setup in order to get configuration loaded synchronously, such as
before you call core.createApp().

# Security

This component is made to be VERY lean. Web servers are very dynamic tools and the valid use cases for how to use them
are across the board. Web server security is also one of those things that has numerous valid use cases. As such this
component does not attempt to enforce any security semantics beyond those built in to NodeJS itself and ExpressJS.

Any security flags you wish to set or unset is up to you. The only explicit configuration exposed for security is the
options field for an HTTPS listener. Other than that, security is on you, just like it is with raw ExpressJS.

# Version Log

This is a log of which version of ExpressJS is provided by each version of StringStack/express.

@stringstack/express@0.0.1 => express@4.16.3
