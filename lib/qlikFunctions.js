import { Agent } from "https";
import { resolve } from "path";
import { readFileSync } from "fs";
import { QlikProxyApi } from "qlik-proxy-api";

const clientCertPath = resolve(process.env.QLIK_CLIENT_CERT_PATH, "client.pem");
const clientKeyPath = resolve(
  process.env.QLIK_CLIENT_CERT_PATH,
  "client_key.pem"
);

// Setup the httpsAgent with certificates
const httpsAgentCert = new Agent({
  rejectUnauthorized: false, // Ignore certificate errors due to Qlik certs being self signed
  cert: readFileSync(clientCertPath),
  key: readFileSync(clientKeyPath),
});

// Create new instance of qlik-proxy-api
const proxyApi = new QlikProxyApi.client({
  host: process.env.QLIK_HOSTNAME,
  port: process.env.QLIK_QPS_PORT ? process.env.QLIK_QPS_PORT : 4243, // optional. default is 4243
  httpsAgent: httpsAgentCert,
  authentication: {
    user_dir: process.env.QLIK_AUTH_USER_DIRECTORY,
    user_name: process.env.QLIK_AUTH_USER_ID,
  },
});

const getTicket = async ({ userId, userDirectory, logger }) => {
  logger.info(`Retrieving ticket for: ${userDirectory}/${userId}`);
  const ticket = await proxyApi.tickets.add({ userId, userDirectory });
  if (ticket.status === 201) {
    logger.info(`Ticket retrieved: ${ticket.data.Ticket}`);
    return ticket.data.Ticket;
  } else {
    logger.error(`Error retrieving ticket: ${userDirectory}/${userId}`);
    throw new Error("Error retrieving ticket");
  }
};

export default getTicket;
