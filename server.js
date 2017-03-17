var express = require('express');
var http = require('http');
var fs = require('fs');
var path = require('path');
var Player = require('./player.js');
Player = Player.Player;

var maxPlayerPerGame = 2;
var players = {};
var games = {
};
var playersGamesMapping = {

}
// games = {
//     'game1': {
//         'isGameOpen': true,
//         'players': {
//             'player1': {},
//             'player2': {}
//         }
//     }
// }

var server = http.createServer(function(request, response){
    var filePath = '.' + request.url;
    if(filePath == './'){
        filePath = './index.html';
    }

    var extName = path.extname(filePath);
    var contentType = 'text/html';
    switch(extName){
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;      
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
    }

    fs.readFile(filePath, function(error, content){
        if(error){

        }else{
            response.writeHead(200, {'Content-Type': contentType});
            response.end(content, 'utf-8');
        }
    });
    // console.log('player name: ' + request.handshake.query);
});

var io = require('socket.io').listen(server);

server.listen(process.env.PORT || 8081);
console.log('server is running in 8081');
io.sockets.on('connection', onSocketConnection);

function onSocketConnection(socket){
    var playerName = socket.handshake.query.name;
    preCreateGame(socket, playerName);
    socket.on("disconnect", onClientDisconnect);
    socket.on("move player", onMovePlayer);
    socket.on('play again', onPlayAgain);
    socket.on('lobby message', onLobbyMessage);
};
function onPlayAgain(data){
    //data.gameId, game completed
    //remove game from games Object if not already deleted
    //remove data.playerId from playersGamesMapping Object
    //new game should updated with data.playerId
    var socket = this;
    var gameId = data.gameId;
    var playerId = data.playerId;
    var playerName = data.playerName;

    if(games[gameId] !== undefined){
        delete games[gameId];
    }
    if(playersGamesMapping[playerId] !== undefined){
        delete playersGamesMapping[playerId];
    }

    preCreateGame(socket, playerName);
};
function preCreateGame(socket, playerName){
    var isExistingGameAvailable = checkForExistingGame();
    if(!isExistingGameAvailable){
        createGame(socket, playerName);
    }else{
        sendLobbyMessage(socket, playerName + ' has joined game: ' + isExistingGameAvailable);
        createNewPlayer(socket, isExistingGameAvailable, playerName);
    }
};
function createGame(socket, playerName){
    var gameId = parseInt(Math.random()*100000).toString();
    games[gameId] = new Object();
    games[gameId].isGameOpen = true;
    games[gameId].players = {};
    console.log('creating new game with id: ' + gameId);
    createNewPlayer(socket, gameId, playerName);
    sendLobbyMessage(socket, playerName + ' created new game: ' + gameId);
};
function checkForExistingGame(){
    var openGameId = 0;
    if(Object.keys(games).length === 0){
        return false;
    }else{
        Object.keys(games).forEach(function(gameId, index){
            if(games[gameId].isGameOpen){
                openGameId = gameId;
            }
        });
        if(openGameId === 0){
            return false;
        }else{
            return openGameId;
        }
    }
};
function onMovePlayer(data){
    // // Not Required for now,
    // // All calculations are done in client side
    // games[data.gameId].players[this.id].setSelection(data.row, data.column);

    // Object.keys(games[data.gameId].players).forEach(function(id, index){
    //     games[data.gameId].players[id].setSelection(data.row, data.column);
    // }.bind(this));    
    this.broadcast.emit('sync move player', {row: data.row, column: data.column, id: this.id, gameId: data.gameId});
    console.log('clicked by: ' + this.id + ', at location: ' + data.row, data.column);
};
function onClientDisconnect() {
    var gameId = playersGamesMapping[this.id];
    var playerName = games[gameId].players[this.id].name;

    delete playersGamesMapping[this.id];
    delete games[gameId].players[this.id];

    if(games[gameId] !== undefined && games[gameId].players !== undefined && Object.keys(games[gameId].players).length === 0){
        //all players are disconnected from game
        //remove game from model
        delete games[gameId];
        console.log('Deleting game from games: ', gameId);
    }else if(games[gameId].players !== undefined){
        //if any player still connected
        //mark that game as open for other players to connect
        console.log('setting ' +[gameId] + ', game isGameOpen: ', true);
        games[gameId].isGameOpen = true;
    }

    this.broadcast.emit("total players", {totalPlayers: Object.keys(playersGamesMapping).length});
    this.broadcast.emit("remove player", {id: this.id});
    this.broadcast.emit("lobby message", {message: playerName + ' disconnected from game: ' + gameId});
    console.log("Player has disconnected: "+this.id);
}; 
function createNewPlayer(data, gameId, playerName) {
    var self = data;
    var symbol = 'O';
    if(Object.keys(games[gameId].players).length === 1){
        if(games[gameId].players[Object.keys(games[gameId].players)[0]].symbol === 'O'){
            symbol = 'X';
        }
    }
    var newPlayer = new Player();
    newPlayer.name = playerName;
    newPlayer.id = self.id;
    newPlayer.gameId = gameId;
    newPlayer.symbol = symbol;
    self.emit("my id", {id: newPlayer.id, symbol: symbol, gameId: gameId});
    //broadcast only with current game id
    self.broadcast.emit("new player", {id: newPlayer.id, symbol: newPlayer.symbol, gameId: gameId, playerName: newPlayer.name});
    //send all remote players of current game
    Object.keys(games[gameId].players).forEach(function(id, index){
        self.emit("remote players", {id: id, symbol: games[gameId].players[id].symbol, playerName: games[gameId].players[id].name});
        console.log('sending player name as: to Local: ' + games[gameId].players[id].name);
    }.bind(self));

    console.log('remote: ' + newPlayer.name);

    games[gameId].players[self.id] = newPlayer;
    if(Object.keys(games[gameId].players).length === maxPlayerPerGame){
        games[gameId].isGameOpen = false;
    }
    playersGamesMapping[self.id] = gameId;
    self.emit("total players", {totalPlayers: Object.keys(playersGamesMapping).length});
    self.broadcast.emit("total players", {totalPlayers: Object.keys(playersGamesMapping).length});
    console.log('new Player connected: ' + self.id + ', in gameId: ' + gameId + ', isGameOpen: ' + games[gameId].isGameOpen + ', players: ' + Object.keys(games[gameId].players).length);
};

function onLobbyMessage(data){
    sendLobbyMessage(this, data.message);
}

function sendLobbyMessage(socket, message){
    socket.emit("lobby message", {message: message});
    socket.broadcast.emit("lobby message", {message: message});
}
















