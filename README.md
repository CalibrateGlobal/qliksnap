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

- `QLIK_TOKEN`: The value of the authentication jwt to be appended to request headers
- `QLIK_VP`: The name of the Qlik virtual proxy being used
- `ALLOWED_ORIGIN`: The origin of requests being made to the application
- `PORT`: Specify the port the server should listen to (default: `8000`)

The `.env-axample` file in the root of the repository contains examples of these values.

### Qlik Virtual Proxy Configuration

- Create a Qlik Virtual Proxy with the appropriate Name, Prefix, Session cookie header name etc:
  - https://help.qlik.com/en-US/sense-admin/August2023/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Administer_QSEoW/Managing_QSEoW/create-virtual-proxy.htm
  - The default prefix and session cookie header name are `jwt` and `X-Qlik-Session-jwt` respectively
  - Ensure that the newly created Virtual Proxy is linked to an existing Proxy
- Generate a valid TLS certificate for the target environment (Note: Using an existing Qlik server certificate is the most straightforward and reliable way to handle this)
- Follow step 1 in the guide below to set up JWT authentication for the Virtual Proxy:
  - https://community.qlik.com/t5/Official-Support-Articles/Qlik-Sense-How-to-set-up-JWT-authentication/ta-p/1716226#toc-hId-1254428716
  - For simpler installations / testing purposes, existing Qlik configured certificates can be used as described in the guide
- Generate a JWT using the above certificate for the intended user:
  - Use an appropriate js tool / dependency to generate the JWT or use `jwt.io` as described in step 2 of the above guide
  - The PAYLOAD should reflect the JWT attributes specified in the Virtual Proxy Setup (i.e. `userId` and `userDirectory`)
  - This JWT should now be appended to the Authorisation header of all Qlik page requests (i.e. `"Authorisation: Bearer <jwt>"`)
- Testing the JWT:
  - Use an extension such as `Modheader` to append the correct Authorisation header to a request made to view the desired Qlik Sense dashboard (with the VP prefix inserted into the URL)
  - Use `curl` to make a GET request with the required Authorisation header to a Qlik API (with the VP prefix inserted into the URL)
  - Use `Postman` etc. to make a GET request with the required Authorisation header to a Qlik API (with the VP prefix inserted into the URL)
  - Make a request to the Qliksnap backend and verify that the correct response is received
  
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
