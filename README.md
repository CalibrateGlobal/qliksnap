# QlikSnap

A Node application allowing users to create a "snapshot" of a Qlik single integration page

## Installation

### Local

- Install the required dependencies by running:

  `npm install`

- Start the server by running:

  `node server.js`

- By default, the application will be available on port 8000

### Docker

- Build the docker image using the following command:

  `docker build -t qliksnap .`

  This will create a "qliksnap" image with the required dependencies

- Run the image as a container using the following command:

  `docker run --rm -p 8000:8000 qliksnap`

  This will run the container, mapping external port 8000 to the same port on the container (it will also remove the container after closing docker)

### Configuration

The application's configuration is set in the .env file located at the root of the repository. This file should contain values for:

- `QLIK_HOSTNAME`: The hostname of the Qlik server utilised for the QPS rest API
- `QLIK_QPS_PORT`: The QPS rest API port (default = 4243)
- `QLIK_SESSION_COOKIE_NAME`: The Qlik session cookie name (default = X-Qlik-Session)
- `ALLOWED_ORIGIN`: The origin of requests being made to the application
- `PORT`: Specify the port the server should listen to (default: `8000`)
- `QLIK_CLIENT_CERT_PATH`: Path to the Qlik client certificates used for QPS API authentication
- `QLIK_AUTH_USER_DIRECTORY`: User directory of a user with privileges to interact with QPS rest API
- `QLIK_AUTH_USER_ID`: User Id of a user with privileges to interact with QPS rest API
- `HTTPS_SSL_KEY_PASS`: Password for Server SSL certificate
- `HTTPS_SSL_CERT`: Path to server SSL certificate
- `NODE_ENV`: Allows node environment to be manually set (A value of `testing` will create an http server, rather than https server with certificates)

The `.env-axample` file in the root of the repository contains examples of these values.

### Qlik Certificate Configuration

- Interaction with the Qlik QPS rest API (for the purpose of retrieving a ticket for the frontend user of the application) requires the use of Qlik client certificates:
  - `client.pem`
  - `client_key.pem`
- These certificates should be located at the following path on the Qlik server to which the API requests are being made:
  - `/Qlik/Sense/Repository/Exported Certificates/.Local Certificates`
- Once retrieved, the certificates should be placed in a location on the backend server which is accessible to the Qliksnap service (preferably within the project's `./certs` folder)
- The `QLIK_CLIENT_CERT_PATH` env variable above specifies the location that the application will look for the required certificates
- Note: The Qlik server to which the QPS rest API requests are being made must be configured to have the QPS rest API port open (by default, this is port 4243, but can be specified using the `QLIK_QPS_PORT` env variable above)

## Usage

- The application utilises a single endpoint:

  `/screenshot`

- Requests to this endpoint should be made via the 'POST' method and include a body specifing:

  - userId - The userId of the user interacting with the frontend application
  - userDirectory - The userDirectory of the user interacting with the frontend application
  - url - the single integration URL, including all required url parameters (such as selections etc.)
  - vpHeight - the height of the headless browser viewport
  - vpWidth - the width of the headless browser viewport
  - exclusionArray - an array listing the css selectors of any elements that should be removed from the snapshot (optional)
  - delay - length of delay (ms) to impose after page load to allow for visualisations to resize etc. (optional, default: 500ms)
  - timeout - length of timeout before error is returned when utilising Puppeteer waitFor functions (optional, default: 10000ms)

- Responses to this endpoint include data in the form of an array buffer (i.e. the image buffer). This will need to be converted to a usable format in the consuming application (e.g. array buffer => blob => data URL etc.)
