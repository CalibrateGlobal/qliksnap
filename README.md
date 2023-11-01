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

The application's configuration is set in the .env file loated at the root of the repository. This file should contain values for:

- `QLIK_TOKEN`: The value of the authentication jwt to be appended to request headers
- `QLIK_VP`: The name of the Qlik virtual proxy being used
- `ALLOWED_ORIGIN`: The origin of requests being made to the application
- `PORT`: Specify the port the server should listen to (default: `8000`)

The `.env-axample` file in the root of the repository contains examples of these values.

## Usage

- The application utilises a single endpoint:

  `/screenshot`

- Requests to this endpoint should be made via the 'POST' method and include a body specifing:

  - url - the single integration URL, including all required url parameters (such as selections etc.)
  - vpHeight - the height of the headless browser viewport
  - vpWidth - the width of the headless browser viewport
  - exclusionArray - an array listing the css selectors of any elements that should be removed from the snapshot (optional)
  - delay - length of delay (ms) to impose after page load to allow for visualisations to resize etc. (optional, default: 500ms)
  - timeout - length of timeout before error is returned when utilising Puppeteer waitFor functions (optional, default: 10000ms)

- Responses to this endpoint include data in the form of an array buffer (i.e. the image buffer). This will need to be converted to a usable format in the consuming application (e.g. array buffer => blob => data URL etc.)
