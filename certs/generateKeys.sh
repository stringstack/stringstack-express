#!/bin/bash -l

# Use this file to generate new self-signed certificates for test and development mode.

# create a new test server certificate

openssl genrsa -out test.key 2048
openssl req -new -key test.key -out test.csr
openssl x509 -req -in test.csr -signkey test.key -out test.crt -days 3650 -sha256