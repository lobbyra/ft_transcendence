import io, { Socket } from "socket.io-client";
import { Game, Player } from "./dataStructures";

export { socket, socketInit };

let socket: Socket;

function socketInit(url:string, gameId: string, vue: Vue): void {
      console.log(vue.$nuxt.$store.state.user.username);
      socket = io(url, {
      query: {
        gameId: gameId,
        userId: vue.$nuxt.$store.state.user.userId,
        username: vue.$nuxt.$store.state.user.username,
      }
  });
  socket.on("connect", () => {
    console.log("Successfully connected to the newsocket game " + gameId);
  });
  socket.on("disconnect", () => {
    console.log("Disconnected to newsocket game " + gameId);
  });
  socket.on("fetchGameTC", (game: Game, serialPlayers: string) => {
    console.log("LOG: fetchGameTC");
    const deserialPlayers: Map<string, Player> = new Map(JSON.parse(serialPlayers));
    game.players = deserialPlayers;
    vue.$data.game = game;
  });
  socket.on("updatePlayersTC", (players: Map<string, Player>) => {
    console.log("LOG: updatePlayersTC");
    vue.$data.game.players = players;
  });
  socket.on("updatePlayerTC", (payload: {userId: string, player: Player}) => {
    console.log("LOG: updatePlayerTC");
    vue.$data.game.players.set(payload.userId, payload.player);
  });
}
