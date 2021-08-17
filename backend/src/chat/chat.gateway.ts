import { Logger, UnauthorizedException } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { ChannelService } from './channel.service'
import { ChannelRepository } from './channel.repository';
import { ChannelI } from "./interfaces/channel.interface";
import { Channel } from './entities/channel.entity';
import { ConnectedUserService } from './connected-user.service';
import { ConnectedUserI } from './interfaces/user-connected.interface';

@WebSocketGateway( { cors: { origin: 'http://localhost:3030', credentials: true }})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

    constructor(
        private readonly userService: UserService,
        private readonly channelService: ChannelService,
        private readonly channelRepository: ChannelRepository,
        private readonly connectedUserService: ConnectedUserService,
    ) {}

    @WebSocketServer() 
    server: Server;

    private logger: Logger = new Logger('ChatGateway');

    afterInit(server: Server) {
        this.logger.log('Initialized !')
    }

    /********************* CREATE CHANNEL **************** */
    @SubscribeMessage('createChannel')
    async onCreateChannel(client: Socket, channel: ChannelI) {
        const createChannel: ChannelI = await this.channelService.createChannel(channel, client.data.user);
        
        for (const user of createChannel.users) {
            const connections: ConnectedUserI[] = await this.connectedUserService.findByUser(user);
            const channels = await this.channelRepository.getChannelsForUser(user.userId);

            for (const connection of connections) {
                await this.server.to(connection.socketId).emit('channel', channels);
            }
        }
    }


    /********************* HANDLE MESSAGE **************** */
    @SubscribeMessage('msgToServer')
    handleMessage(client: Socket, text: string) {
        this.logger.log('New message from a socket !');
        // this.server.to(message.room).emit('msgToClient', message);
        this.server.emit('msgToClient',text);
    }

    // @SubscribeMessage('joinRoom')
    // handleJoinRoom(client: Socket, room: string) {
    //     client.join(room);
    //     client.emit('joinedRoom', room);
    // }

    // @SubscribeMessage('leaveRoom')
    // handleLeaveRoom(client: Socket, room: string) {
    //     client.leave(room);
    //     client.emit('leftRoom', room);
    // }




    /********************* CONNECTION ********************** */
    async handleConnection(client: Socket) {
        try {
            const user: User = await this.channelService.getUserFromSocket(client);            
            if (!user) {
                return this.disconnectClient(client);
            } 
            else {
                client.data.user = user;
                console.log(user.username);
                const channels = await this.channelRepository.getChannelsForUser(user.userId);

                // save connection
                await this.connectedUserService.create({socketId: client.id, user});
                // emit channels for the specific user
                return this.server.to(client.id).emit('channel', channels);
            }
        } catch {
            console.log("ok disc.");
            return this.disconnectClient(client);
        }
    }

    /********************* DISCONNECTION ****************** */
    async handleDisconnect(client: Socket) {
        // remove connection from db
        await this.connectedUserService.deleteBySoketId(client.id);
        client.disconnect();
        this.logger.log(`Client diconnect: ${client.id}`);
    }

    private disconnectClient(client: Socket) {
        client.emit('Error', new UnauthorizedException());
        client.disconnect();
    }
}