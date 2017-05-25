import * as http from 'http';
import * as url from 'url';
import * as minimist from 'minimist';
import {OrchestratorServer} from './server';

export async function main(argv) {
  const config = minimist(argv, {
    boolean: ['help'],
    string: ['host', 'port', 'meeting-id', 'meeting-password']
  });

  if (config.help) {
    console.log(`
Usage: musicociel-orchestrator [options]

Available options:
 --help                                  Prints this help message and exits.
 --host <host>                           Host to use for the server
 --port <port>                           Port to use for the server
 --meeting-id <meeting-id>               Meeting id
 --meeting-password <meeting-password>   Meeting password
`
    )
    return 1;
  }

  const httpServer = http.createServer();
  httpServer.on('request', (req, res) => {
    res.end();
  });
  httpServer.on('upgrade', (req, res) => {
    res.end();
  });

  const orchestrator = new OrchestratorServer();
  const meetingId = config['meeting-id'] || 'privateMeeting';
  const meetingPassword = config['meeting-password'] || 'secret';
  orchestrator.createMeeting(meetingId, meetingPassword);

  orchestrator.installHandlers(httpServer, {
    prefix: '/orchestrator'
  });

  httpServer.listen(config.port, config.host);
  httpServer.on('listening', () => {
    const address = httpServer.address();
    console.log(`Listening on ${address.address}:${address.port}`);

    const meetingURL = url.format({
      protocol: 'http:',
      hostname: address.address,
      port: `${address.port}`,
      pathname: '/orchestrator',
      query: {
        meetingId,
        meetingPassword
      }
    });
    console.log(`Enter the following address in Musicociel to orchestrate multiple clients: ${meetingURL}`);
  });

  await new Promise(() => {}); // never resolving promise
}
