import * as sockjs from 'sockjs';

export class Client {
  meeting: Meeting | null = null;

  constructor(public server: OrchestratorServer, public socket) {
    this.onMessage = this.onMessage.bind(this);
    this.onClose = this.onClose.bind(this);
    socket.on('data', this.onMessage);
    socket.on('close', this.onClose);
    server.clients.push(this);
  }

  async onMessage(message) {
    try {
      const data = JSON.parse(message);
      const type = data.type;
      const handler = this[`onMessage_${type}`];
      if (!handler) {
        throw new Error(`Invalid message type: ${type}`);
      }
      await handler.call(this, data);
    } catch (e) {
      console.error(`Error while handling message: ${message}\n${e}`);
    }
  }

  send(data) {
    this.socket.write(JSON.stringify(data));
  }

  async onMessage_joinMeeting(data) {
    if (this.meeting) {
      return;
    }
    const meetingId = data.meetingId;
    const meetingPassword = data.meetingPassword;
    const meeting = this.server.meetings[meetingId];
    if (!meeting || meeting.password !== meetingPassword) {
      return;
    }
    this.meeting = meeting;
    meeting.clients.push(this);
    if (meeting.song) {
      this.send({
        type: 'setSong',
        song: meeting.song
      });
      if (meeting.songPosition) {
        this.send({
          type: 'setSongPosition',
          songPosition: meeting.songPosition
        });
      }
    }
  }

  async onMessage_setSong(data) {
    if (this.meeting) {
      this.meeting.setSong(data.song);
    }
  }

  async onMessage_setSongPosition(data) {
    if (this.meeting) {
      this.meeting.setSongPosition(data.songPosition);
    }
  }

  async onClose() {
    const index = this.server.clients.indexOf(this);
    if (index > -1) {
      this.server.clients.splice(index, 1);
    }
    if (this.meeting) {
      const indexInMeeting = this.meeting.clients.indexOf(this);
      if (index > -1) {
        this.meeting.clients.splice(indexInMeeting, 1);
      }
    }
  }
}

export class Meeting {
  clients: Client[] = [];
  song: any;
  songPosition: any;

  constructor(public server: OrchestratorServer, public id: string, public password: string) {
    server.meetings[id] = this;
  }

  send(data) {
    const message = JSON.stringify(data);
    for (const client of this.clients) {
      client.socket.write(message);
    }
  }

  setSong(song) {
    this.song = song;
    this.songPosition = null;
    this.send({
      type: 'setSong',
      song
    });
  }

  setSongPosition(songPosition) {
    this.songPosition = songPosition;
    this.send({
      type: 'setSongPosition',
      songPosition
    });
  }
}

export class OrchestratorServer {
  sockJSServer;
  meetings: {[id: string]: Meeting} = {};
  clients: Client[] = [];

  constructor() {
    this.sockJSServer = sockjs.createServer();
    this.onConnection = this.onConnection.bind(this);
    this.sockJSServer.on('connection', this.onConnection);
  }

  createMeeting(id, password) {
    new Meeting(this, id, password);
  }

  onConnection(socket) {
    new Client(this, socket);
  }

  installHandlers(httpServer, options) {
    this.sockJSServer.installHandlers(httpServer, options);
  }
}
