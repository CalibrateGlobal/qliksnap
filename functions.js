const https = require("https");

const getTicket = ({ userId, userDirectory, authURL, appPath, logger }) => {
  let XRFKEY = rand(16);
  //Configure parameters for the ticket request

  let url = new URL(authURL);
  let options = {};

  logger.info(url);
  logger.info(url.host);
  logger.info(url.port);
  logger.info(url.pathname);

  options = {
    host: url.hostname,
    port: url.port,
    path: url.pathname + "/ticket?xrfkey=" + XRFKEY,
    method: "POST",
    headers: {
      "X-qlik-xrfkey": XRFKEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QLIK_TOKEN}`,
    },
    /* cert: fs.readFileSync(cfg.certificates.client),
      key: fs.readFileSync(cfg.certificates.client_key), */
    rejectUnauthorized: false,
    agent: false,
  };

  logger.info(options);
  //Send ticket request
  let ticketreq = https.request(options, function (ticketres) {
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

module.exports = {
  getTicket,
};
