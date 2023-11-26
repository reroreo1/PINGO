import { OnGatewayConnection, WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayDisconnect } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';

interface Ball {
  pos: {x: number, y: number},
  speed: number,
  angle: number
}


@WebSocketGateway({ cors: true, namespace: 'game' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private waitingFriend: Socket | null = null;

  private waitingRooms: Record<string, Socket | null> = {
    classic: null,
    crazy: null,
  };

  private rooms: Record<string, { ballPos: { x: number, y: number }, moveAngle: number, ballSpeed: number, intervalId: NodeJS.Timer | null, players: { id: string, pos: number }[] }> = {};

  handleConnection(client: Socket, ...args: any[]) {
    console.log('A client just connected: ' + client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('A client disconnected: ' + client.id);
    for (const gameMode in this.waitingRooms) {
      if (this.waitingRooms[gameMode]?.id === client.id) {
        this.waitingRooms[gameMode] = null;
      }
    }
  }


  @SubscribeMessage('friends')
  handleFriendsMode(client: Socket): void {
    if (this.waitingFriend)
    {
      const room = `${this.waitingFriend.id}-${client.id}`;
      client.join(room);
      this.waitingFriend.join(room);

      const initialBall: Ball = { pos: {x: 0, y: 0}, speed: 6 / 16, angle: Math.PI / 4 };

      this.rooms[room] = { 
        ballPos: initialBall.pos, 
        moveAngle: initialBall.angle, 
        ballSpeed: initialBall.speed, 
        intervalId: setInterval(() => this.updateBallPosition(room, initialBall, "classic"), 1000 / 60),
        players: [{id: this.waitingFriend.id, pos: 0}, {id: client.id, pos: 0}]
      };

      this.server.to(this.waitingFriend.id).emit('startgame', {room: room, SecondPlayer: 1, chosen: "classic"});
      this.server.to(client.id).emit('startgame', {room: room, SecondPlayer: 2, chosen: "classic"});

      this.waitingFriend = null;
    }
    else {
      this.waitingFriend = client;
    }
  }

  @SubscribeMessage('gameMode')
  handleGameMode(client: Socket, gameMode: 'classic' | 'crazy'): void {
    console.log(`Client ${client.id} chose ${gameMode} mode`);

    if (this.waitingRooms[gameMode]) {
      const room = `${this.waitingRooms[gameMode].id}-${client.id}`;
      client.join(room);
      this.waitingRooms[gameMode].join(room);

      const initialBall: Ball = { pos: {x: 0, y: 0}, speed: 6 / 16, angle: Math.PI / 4 };

      this.rooms[room] = { 
        ballPos: initialBall.pos, 
        moveAngle: initialBall.angle, 
        ballSpeed: initialBall.speed, 
        intervalId: setInterval(() => this.updateBallPosition(room, initialBall, gameMode), 1000 / 60),
        players: [{id: this.waitingRooms[gameMode].id, pos: 0}, {id: client.id, pos: 0}]
      };

      this.server.to(this.waitingRooms[gameMode].id).emit('startgame', {room: room, SecondPlayer: 1, chosen: gameMode});
      this.server.to(client.id).emit('startgame', {room: room, SecondPlayer: 2, chosen: gameMode});

      console.log(`Game started in ${gameMode} mode between ${this.waitingRooms[gameMode].id} and ${client.id}`);

      this.waitingRooms[gameMode] = null;
    } else {
      this.waitingRooms[gameMode] = client;
    }
  }

  updateBallPosition(room: string, ball: Ball, mode: string): void {
    let newX = ball.pos.x - (ball.speed * Math.cos(ball.angle));
    let newY = ball.pos.y + (ball.speed * Math.sin(ball.angle));

    const paddleHeight = 6.625;


    if (newX > 540 / 16 && newY <= this.rooms[room].players[1].pos + paddleHeight / 2 && newY >= this.rooms[room].players[1].pos - paddleHeight / 2) {
      newX = 540 / 16;
      ball.angle = Math.PI - ball.angle;
    }

    if (newX < -535 / 16 && newY <= this.rooms[room].players[0].pos + paddleHeight / 2 && newY >= this.rooms[room].players[0].pos - paddleHeight / 2) {
      newX = -535 / 16;
      ball.angle = Math.PI - ball.angle;
    }


    if ((newX < -575 / 16 || newX > 580 / 16)) {

      if (newX < -575 / 16) {
        this.server.to(this.rooms[room].players[0].id).emit('rightscored');
        this.server.to(this.rooms[room].players[1].id).emit('leftscored');
        newX = 0;
        newY = 0;
        ball.speed = 6 / 16;
      }
      else if (newX > 580 / 16) {
        this.server.to(this.rooms[room].players[0].id).emit('leftscored');
        this.server.to(this.rooms[room].players[1].id).emit('rightscored');
        newX = 0;
        newY = 0;
        ball.speed = 6 / 16;
      }
    }

    if (newY < -320 / 16 || newY > 325 / 16) {
      newY = newY < -320 / 16 ? (-320 / 16) : (325 / 16);
      ball.angle *= -1;
      ball.speed += 0.03;
    }

    ball.pos = {x: newX, y: newY};
    this.server.to(this.rooms[room].players[0].id).emit('ballmove', ball.pos);
    this.server.to(this.rooms[room].players[1].id).emit('ballmove', ball.pos);

  }


  @SubscribeMessage('paddlemove')
  handlepaddlemove(client: Socket, payload: { room: string, pos: number, SecondPlayer: number }): void {
    // console.log(`Payload:`, payload.pos);
    client.broadcast.to(payload.room).emit('paddlemove', payload.pos);
    if (this.rooms[payload.room] && payload.SecondPlayer === 1) {
      this.rooms[payload.room].players[0].pos = payload.pos;
    }
    
    else if (this.rooms[payload.room] && payload.SecondPlayer === 2) {
      this.rooms[payload.room].players[1].pos = payload.pos;
    }
  }
  
  @SubscribeMessage('gameended')
  handleEndgame(client: Socket, payload: { room: string }): void {
  }



}