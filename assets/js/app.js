var localPlayer;
var remotePlayers = {};
var url = window.location.origin;
var socket;
var canPlay = false;
var totalPlayers = 0;
var connectionStarted = false;
var playerName = '';

function connectToSocket(){
    if(connectionStarted) return;
    connectionStarted = true;
    playerName = document.getElementById('playerName').value;
    if(playerName === '')
        playerName = "Player";
    // console.log(this);
    // console.log(name);
    socket = io.connect(url, {query: 'name=' + playerName});
    setEventHandlers();
}

function setEventHandlers(){
    socket.on("disconnect", onSocketDisconnect);
    socket.on("new player", onNewPlayer);
    socket.on("sync move player", onSyncMovePlayer);
    socket.on("remove player", onRemovePlayer);
    socket.on("remote players", onRemotePlayers);
    socket.on("total players", ontotalPlayers);
    socket.on("lobby message", onLobbyMessage);
    socket.on("my id", onMyId);
    addGameEvents();
};

function onSocketDisconnect() {
    console.log("Disconnected from socket server");
};
function onMyId(data){
    var e = document.getElementById("intro");
    e.addEventListener("animationstart", listener, false);
    e.addEventListener("animationend", listener, false);
    e.addEventListener("animationiteration", listener, false);
    e.className = "slidein";
    console.log("got my Id from server: "+data.id);
    var newPlayer = new Player();
    newPlayer.id = data.id;
    newPlayer.name = playerName;
    newPlayer.symbol = data.symbol;
    newPlayer.gameId = data.gameId;
    localPlayer = newPlayer;
    document.getElementById('gameId').innerHTML = "Game: " + data.gameId;
    document.getElementById('welcomeMessage').innerHTML = "Welcome: " + localPlayer.name;
    document.getElementById('playerCount').innerHTML = '1 Connected: Waiting for Another Player';
    resetGame();
}
function onNewPlayer(data) {
    //check if Player if from same game or different game
    console.log("Other New player connected: " + data.id, ' gameId: ' + data.gameId);
    if(data.gameId === localPlayer.gameId){
        console.log('New Player added to Current Game');
        var newPlayer = new Player();
        newPlayer.id = data.id;
        newPlayer.symbol = data.symbol;
        newPlayer.gameId = data.gameId;
        newPlayer.name = data.playerName;
        remotePlayers[data.id] = newPlayer;
        document.getElementById('playerCount').innerHTML = 'Game Connected: Your Turn';
        document.getElementById('playingWith').innerHTML = 'Playing With: ' + data.playerName;
        enableGame();
    }
};
function onRemotePlayers(data){
    //Already filtered out in server
    //We'll get only players who are connected to this game
    console.log("remote Players: " + data.id, ' gameId: ' + data.gameId);
    var newPlayer = new Player();
    newPlayer.id = data.id;
    newPlayer.symbol = data.symbol;
    newPlayer.gameId = data.gameId;
    newPlayer.name = data.playerName;
    remotePlayers[data.id] = newPlayer;
    document.getElementById('playingWith').innerHTML = 'Playing With: ' + data.playerName;
    document.getElementById('playerCount').innerHTML = 'Game Connected: Wait For Your Turn';
    // remotePlayers.push(newPlayer);
}
function onSyncMovePlayer(data) {
    if(data.gameId === localPlayer.gameId){
        document.getElementById('child' + data.row + data.column).innerHTML = remotePlayers[data.id].symbol;
        localPlayer.setSelection(data.row, data.column, remotePlayers[data.id].symbol);
        remotePlayers[data.id].setSelection(data.row, data.column, remotePlayers[data.id].symbol)

        localPlayer.setClicks(localPlayer.getClicks() + 1);
        remotePlayers[Object.keys(remotePlayers)[0]].setClicks(remotePlayers[Object.keys(remotePlayers)[0]].getClicks() + 1);
        enableGame();
        console.log('Player move: ' + data.row, data.column, remotePlayers[data.id].symbol);
        document.getElementById('playerCount').innerHTML = 'Game Connected: Your Turn: ' + localPlayer.symbol;

        checkRemoteWinnings();
    }
};
function onRemovePlayer(data) {
    if(remotePlayers[data.id] !== undefined){
        console.log('Remove Player: ' + data.id);
        delete remotePlayers[data.id];
        //2 Player game, so reset and disable game of localPlayer
        //when other player got Disconnected
        resetGame();
        disableGame();
        document.getElementById('playingWith').innerHTML = "Player Disconnected";
        document.getElementById('playerCount').innerHTML = '1 Connected: Waiting for Another Player';
    }
};

function addGameEvents(){
    for(var i = 0; i <= 2; i++){
        for(var j = 0; j <= 2; j++){
            var elem = document.getElementById('child' + i + j);
            elem.addEventListener('click', function(i, j){
                if(!canPlay){return;};
                if(!localPlayer.isClickable(i, j)){
                    return;
                }
                document.getElementById('child' + i + j).innerHTML = localPlayer.symbol;
                socket.emit('move player', {
                    row: i,
                    column: j,
                    gameId: localPlayer.gameId
                });
                console.log('clicked child' + i + j);
                localPlayer.setSelection(i, j);
                remotePlayers[Object.keys(remotePlayers)[0]].setSelection(i, j, localPlayer.symbol);
                console.log('clicks: ' + localPlayer.getClicks());
                localPlayer.setClicks(localPlayer.getClicks() + 1);
                // localPlayer.clicks +=1;
                remotePlayers[Object.keys(remotePlayers)[0]].setClicks(remotePlayers[Object.keys(remotePlayers)[0]].getClicks() + 1);
                document.getElementById('playerCount').innerHTML = 'Game Connected: Wait For Your Turn: ' + localPlayer.symbol;
                disableGame();
                checkWinnings();
            }.bind(this, i, j));
        }
    }
    jQuery('#playAgain').on('click', function(){
        socket.emit('play again', {
            gameId: localPlayer.gameId,
            playerId: localPlayer.id,
            playerName: localPlayer.name
        });
    });
};

function checkRemoteWinnings(){
    console.log('checkRemoteWinnings');
    if(remotePlayers[Object.keys(remotePlayers)[0]].hasWon()){
        document.getElementById('winner').innerHTML = 'You Loose!';
    }else if(remotePlayers[Object.keys(remotePlayers)[0]].getClicks() == 9){
        document.getElementById('winner').innerHTML = 'Draw!';
    }else{
        return;
    }
    disableGame();
    document.getElementById('playerCount').innerHTML = "Game completed.";
    document.getElementById('playAgain').style.display = 'block';
    document.getElementById('winner').style.display = 'block';
}

function checkWinnings(){
    console.log('checkWinnings');
    if(localPlayer.hasWon()){
        document.getElementById('winner').innerHTML = 'You Won!';
        socket.emit('lobby message', {message: localPlayer.name + ' has won game: ' + localPlayer.gameId});
    }else if(localPlayer.getClicks() == 9){
        document.getElementById('winner').innerHTML = 'Draw!';
    }else{
        return;
    }
    disableGame();
    document.getElementById('playerCount').innerHTML = "Game Compleated.";
    document.getElementById('winner').style.display = 'block';
    document.getElementById('playAgain').style.display = 'block';
}

function enableGame(){
    canPlay = true;
    document.getElementById('parent').className = '';
    console.log('enableGame');
}

function disableGame(){
    canPlay = false;
    document.getElementById('parent').className = 'disabled';
    console.log('disableGame');
}

function resetGame(){
    for(var i = 0; i <= 2; i++){
        for(var j = 0; j <= 2; j++){
            document.getElementById('child' + i + j).innerHTML = '';
        }
    }
    localPlayer.resetGame();
    remotePlayers = {};
    jQuery('#winner').hide();
    jQuery('#playAgain').hide();
    document.getElementById('playingWith').innerHTML = "Playing With: ";
    console.log('resetGame');
}

function ontotalPlayers(data){
    document.getElementById('totalPlayers').innerHTML = "Total Players: " + data.totalPlayers;
}

function makeName(){
    var random = Math.floor(Math.random() * (50));
    return nameList[random];
}

function onLobbyMessage(data){
    var lobby = document.getElementById('lobby');
    lobby.scrollTop = lobby.scrollHeight;
    document.getElementById('content').innerHTML += "<p>" + data.message + "</p>";
}