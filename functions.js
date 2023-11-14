import { Agent, request } from "https";
import { resolve } from "path";
import { readFileSync } from "fs";
import { QlikProxyApi } from "qlik-proxy-api";

console.log(process.env.QLIK_CLIENT_CERT_PATH);

const clientCertPath = resolve(process.env.QLIK_CLIENT_CERT_PATH, "client.pem");
const clientKeyPath = resolve(
  process.env.QLIK_CLIENT_CERT_PATH,
  "client_key.pem"
);

// setup the httpsAgent
//   - read the certificates
//   - ignore certificate errors
const httpsAgentCert = new Agent({
  rejectUnauthorized: false,
  cert: readFileSync(clientCertPath),
  key: readFileSync(clientKeyPath),
});

// create new instance or qlik-proxy-api
const proxyApi = new QlikProxyApi.client({
  host: process.env.QLIK_HOSTNAME,
  port: process.env.QLIK_QPS_PORT, // optional. default is 4243
  httpsAgent: httpsAgentCert,
  authentication: {
    user_dir: process.env.QLIK_AUTH_USER_DIRECTORY,
    user_name: process.env.QLIK_AUTH_USER_ID,
  },
});

const getTicket = async ({
  userId,
  userDirectory,
  authURL,
  appPath,
  logger,
}) => {
  /*  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; */

  console.log(userId, userDirectory);

  const ticket = await proxyApi.tickets.add({ userId, userDirectory });

   console.log(ticket);

  console.log(process.env.NODE_TLS_REJECT_UNAUTHORIZED);

  let XRFKEY = rand(16);
  //Configure parameters for the ticket request

  let url = new URL(authURL);
  let options = {};

  logger.info(url);
  logger.info(url.host);
  logger.info(url.port);
  logger.info(url.pathname);

  /*   const clientCertPath = path.resolve(
    process.env.QLIK_CLIENT_CERT_PATH,
    "client.pem"
  );
  const clientKeyPath = path.resolve(
    process.env.QLIK_CLIENT_CERT_PATH,
    "client_key.pem"
  ); */

  console.log("client", readFileSync(clientCertPath));

  // sa_scheduler

  options = {
    host: url.hostname,
    port: url.port,
    path: url.pathname + "/ticket?xrfkey=" + XRFKEY,
    method: "POST",
    headers: {
      "X-qlik-xrfkey": XRFKEY,
      "Content-Type": "application/json",
      "X-Qlik-User": `UserDirectory=${userDirectory}; UserId=${userId}`,
      /* Authorization: `Bearer ${process.env.QLIK_TOKEN}`, */
    },
    /* cert: fs.readFileSync(cfg.certificates.client),
      key: fs.readFileSync(cfg.certificates.client_key), */
    cert: readFileSync(clientCertPath),
    key: readFileSync(clientKeyPath),
    rejectUnauthorized: false,

    agent: false,
  };

  /* logger.info(options); */
  //Send ticket request
  let ticketreq = request(options, function (ticketres) {
    /* console.log(ticketres); */
    logger.info(`requestTicket: statusCode: (${ticketres.statusCode})`);

    ticketres.on("data", function (d) {
      //Parse ticket response
      logger.info("requestTicket: POST Response \n", d.toString());
      if (ticketres.statusCode != 201) {
        throw new Error(`Invalid response code: ${ticketres.statusCode}`);
      } else {
        // Get the ticket returned by Qlik Sense
        let ticket = JSON.parse(d.toString());
        logger.info("requestTicket: Qlik Sense Ticket \n", ticket);

        let redirectUri = "https://" + options.host + "/" + process.env.QLIK_VP;
        logger.debug(`requestTicket: (${redirectUri})`);

        let finalRedirectURI =
          redirectUri + appPath + "?Qlikticket=" + ticket.Ticket;
        logger.debug(`requestTicket: Redirecting to (${finalRedirectURI})`);

        return finalRedirectURI;
      }
    });
  });

  //Send JSON request for ticket
  let jsonrequest = JSON.stringify({
    userDirectory: userDirectory.toString(),
    UserId: userId.toString(),
    Attributes: [],
  });
  logger.debug("requestTicket: JSON request: ", jsonrequest);

  ticketreq.write(jsonrequest);
  ticketreq.end();

  ticketreq.on("error", function (e) {
    logger.error(
      ` requestTicket: Error submitting authentication request (
    ${e}
      )`
    );
    logger.error("Error" + e);
  });
};

//Supporting functions
function rand(length, current) {
  current = current ? current : "";
  return length
    ? rand(
        --length,
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".charAt(
          Math.floor(Math.random() * 60)
        ) + current
      )
    : current;
}

/* module.exports = {
  getTicket,
}; */

export default getTicket;
