require('dotenv').config()
const express = require('express');
const app = express()
const http = require('http').Server(app)
const socketio = require('socket.io');
const CryptoJS = require("crypto-js");
var cors = require('cors');

const { generateGetUrl, generatePutUrl } = require('./AWSPresigner');

var url = "mongodb://localhost:27017";
var MongoClient = require('mongodb').MongoClient;
var db;

// Initialize connection once
MongoClient.connect(url, {useUnifiedTopology: true}, function(err, database) {
    if(err) throw err;
    db = database.db('roomsdb'); // creating a connection to the database named 'roomsdb'
});

const port = 5000;

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000',
    "Access-Control-Allow-Origin": "http://localhost:3000",
}));

// GET URL
app.get('/api/generate-get-url', (req, res) => {
    // Both Key and ContentType are defined in the client side.
    // Key refers to the remote name of the file.
    const { Key } = req.query;
    generateGetUrl(Key)
        .then(getURL => {      
        res.send(getURL);
        })
        .catch(err => {
        res.send(err);
        });
});
  
// PUT URL
app.get('/api/generate-put-url', (req,res)=>{
    // Both Key and ContentType are defined in the client side.
    // Key refers to the remote name of the file.
    // ContentType refers to the MIME content type, in this case image/jpeg
    res.header("Access-Control-Allow-Credentials", true);
    const { Key, ContentType } =  req.query;
    generatePutUrl(Key, ContentType).then(putURL => {
        res.send({putURL});
    })
    .catch(err => {
        res.send(err);
    });
});

//Bind socket.io socket to http server
const io = socketio(http);


function initialData(roomCode, username, socket) {
    // data
    let roomData = {
        roomCode: roomCode,
        users: [username],
        signatures: {}, 
        pilotModeActivated: false
    }

    db.collection("rooms").insertOne(roomData, function(err, res) {
        if(err) throw err;
    })
}

function get(object, key, default_value) {
    var result = object[key];
    return (typeof result !== "undefined") ? result : default_value;
}

//define socket.io behavior when users connect
io.on('connection', (socket)=>{

    //check if database has canvas if not request it, if it does send it to users
    socket.emit('join');
    socket.on('join', ({ username, roomCode, creation }) => {
        socket.join(roomCode);

        console.log(`${username} just joined ${roomCode}`)
        db.collection("rooms").findOne({ roomCode: roomCode }, function(err, result) {
            if (err) throw err; 

            // database found under given roomCode (the roomCode that the person entered when joining the room)
            // (the room exists)
            if (result !== null) {

                console.log(`fetching data from room: ${roomCode}`)

                // update the list of users in the database
                result.users.push(username);
                db.collection("rooms").updateOne({ roomCode: roomCode }, {$set: { users: result.users }});

                // broadcast to every other users in the room that this user joined
                // with the newly updated list of users 
                // socket.to(roomCode).emit('userJoined', result.users, username);
                socket.to(roomCode).emit('updateCurrentUsers', result.users);
                socket.emit('updateCurrentUsers', result.users);
            } 
            // room create
            else if (result === null && creation) {
                // initial room
                initialData(roomCode, username, socket)
                socket.emit('updateCurrentUsers', [username]);
            }
            
            // could not find the database under the given roomCode
            // (the room does not exist)
            else {
                socket.emit('invalidRoomCode')
            }
        });

        // //force send clients canvas that are missing it
        // socket.on('missingCanvas', (data) => {
        //     socket.emit('canvasSetup', canvasData);
        // })

        // person requests the signature objects that are on the page
        // the callback function requires the signature objects
        // this happens when somebody joins the room and renders the page for the first time
        socket.on('getCurrentPageSignatures', (pageNum, callback) => {
            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;

                // the list of signatures for that page from the database (encrypted)
                let currentPageSignatures = get(result.signatures, pageNum.toString(), null)
                let decryptedSignatureObjectList = []
                if (currentPageSignatures !== null) {
                    // decryption
                    let bytes  = CryptoJS.AES.decrypt(currentPageSignatures, process.env.ENCRYPT_KEY);
                    decryptedSignatureObjectList = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                }
                callback(decryptedSignatureObjectList);
            })
        })

        socket.on("addIn", (pageData) => {
            const { pageNum, newSignatureObjectJSON } = pageData
            
            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;

                // the list of signatures for that page from the database (encrypted)
                let currentPageSignatures = get(result.signatures, pageNum.toString(), null)
                let decryptedSignatureObjectList = []
                if (currentPageSignatures !== null) {
                    // decrypt
                    let bytes  = CryptoJS.AES.decrypt(currentPageSignatures, process.env.ENCRYPT_KEY);
                    decryptedSignatureObjectList = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                }
                
                // add the new signature to the list
                decryptedSignatureObjectList.push(newSignatureObjectJSON);

                // encrypt the list again before updating the database
                let encrypted = CryptoJS.AES.encrypt(JSON.stringify(decryptedSignatureObjectList), process.env.ENCRYPT_KEY).toString();
                // update the database
                result.signatures[pageNum.toString()] = encrypted
                db.collection("rooms").updateOne({ roomCode: roomCode}, {$set: {signatures: result.signatures}})

                // emit the changes to other users in the room
                socket.to(roomCode).emit('addOut', pageData)
            })
        })

        socket.on('editIn', (pageData) => {
            const {pageNum, modifiedSignatureObjectJSON} = pageData

            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;

                // the list of signatures for that page from the database (encrypted)
                let currentPageSignatures = get(result.signatures, pageNum.toString(), null)
                let decryptedSignatureObjectList = []
                if (currentPageSignatures !== null) {
                    // decrypt
                    let bytes  = CryptoJS.AES.decrypt(currentPageSignatures, process.env.ENCRYPT_KEY);
                    decryptedSignatureObjectList = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                }

                // remove the old signature from the list (before the modification)
                decryptedSignatureObjectList.forEach(function(currentSignatureObjectJSON) {
                    if (modifiedSignatureObjectJSON.id === currentSignatureObjectJSON.id) {
                        decryptedSignatureObjectList.splice( decryptedSignatureObjectList.indexOf(currentSignatureObjectJSON), 1 );
                    }
                })

                // add the new signature to the list (after the modification)
                decryptedSignatureObjectList.push(modifiedSignatureObjectJSON);

                // encrypt the list again before updating the database
                let encrypted = CryptoJS.AES.encrypt(JSON.stringify(decryptedSignatureObjectList), process.env.ENCRYPT_KEY).toString();
                // update the database
                result.signatures[pageNum.toString()] = encrypted
                db.collection("rooms").updateOne({ roomCode: roomCode}, {$set: {signatures: result.signatures}})

                // emit the changes to other users in the room
                socket.to(roomCode).emit('editOut', pageData)
            })
        })

        socket.on('deleteIn', (pageData) => {
            const {pageNum, removedSignatureObjectJSON} = pageData

            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;

                // the list of signatures for that page from the database (encrypted)
                let currentPageSignatures = get(result.signatures, pageNum.toString(), null)
                let decryptedSignatureObjectList = []
                if (currentPageSignatures !== null) {
                    // decrypt
                    let bytes  = CryptoJS.AES.decrypt(currentPageSignatures, process.env.ENCRYPT_KEY);
                    decryptedSignatureObjectList = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                }

                // remove the old signature from the list (before the modification)
                decryptedSignatureObjectList.forEach(function(currentSignatureObjectJSON) {
                    if (removedSignatureObjectJSON.id === currentSignatureObjectJSON.id) {
                        decryptedSignatureObjectList.splice( decryptedSignatureObjectList.indexOf(currentSignatureObjectJSON), 1 );
                    }
                })

                // encrypt the list again before updating the database
                let encrypted = CryptoJS.AES.encrypt(JSON.stringify(decryptedSignatureObjectList), process.env.ENCRYPT_KEY).toString();
                // update the database
                result.signatures[pageNum.toString()] = encrypted
                db.collection("rooms").updateOne({ roomCode: roomCode}, {$set: {signatures: result.signatures}})

                // emit the changes to other users in the room
                socket.to(roomCode).emit('deleteOut', pageData)
            })
        })

        // Pilot Mode
        socket.on("pilotModeRequested", (requestData) => {
            // const { requesterUsername, requesterSocketID, currNumUsers } = requestData
            console.log("pilotModeRequested")
            // emit to everyone else in the room to either accept or decline the request

            socket.to(roomCode).emit('confirmPilotMode', requestData)
        })

        var confirmedCount = 0
        // var pmDenied = false
        socket.on("pilotModeRequestCallback", (callbackData) => {
            const {confirmed, confirmingUser, requesterSocketID, currNumUsers} = callbackData
            console.log(confirmed, confirmingUser)
            console.log("numUsers", currNumUsers)
            console.log("confirmedCount before", confirmedCount)
            if (confirmed) {
                confirmedCount++;
            } else {
                confirmedCount = 0
                socket.to(requesterSocketID).emit("pilotModeDeclined", confirmingUser)
            }
            console.log("confirmedCount after", confirmedCount)
            if (currNumUsers === confirmedCount) {
                db.collection("rooms").updateOne({ roomCode: roomCode}, {$set: {pilotModeActivated: true}})
                console.log("pilotModeConfirmed")
                confirmedCount = 0
                socket.to(requesterSocketID).emit("pilotModeConfirmed")
                // socket.in(roomCode).emit("pilotModeConfirmed", requesterSocketID)
            }
        })

        socket.on("sendScrollPercent", (scrollPercent) => {
            socket.to(roomCode).emit("setScrollPercent", scrollPercent)
        })




        socket.on("reconnect", () => {
            console.log('reconnect')
            socket.emit("reconnect")
        })

        socket.on('reconnected', () => {
            console.log('reconnected')
            // update the list of users in the database
            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;
                if (result) {
                    // remove the first occurence of the username from database
                    result.users.splice(result.users.indexOf(username), 1);
                    db.collection("rooms").updateOne({ roomCode: roomCode }, {$set: { users: result.users }});

                    // broadcast to every other users in the room that this user joined
                    // with the newly updated list of users 
                    // socket.to(roomCode).emit('userDisconnected', result.users, username);
                    socket.to(roomCode).emit('updateCurrentUsers', result.users);
                }
            })
        })

        socket.on("disconnect", () => {
            console.log(`${username} just left ${roomCode}`);
            
            // update the list of users in the database
            db.collection("rooms").findOne({roomCode: roomCode}, function(err, result) {
                if (err) throw err;
                if (result) {
                    // remove the first occurence of the username from database
                    result.users.splice(result.users.indexOf(username), 1);
                    db.collection("rooms").updateOne({ roomCode: roomCode }, {$set: { users: result.users }});

                    // broadcast to every other users in the room that this user joined
                    // with the newly updated list of users 
                    // socket.to(roomCode).emit('userDisconnected', result.users, username);
                    socket.to(roomCode).emit('updateCurrentUsers', result.users);
                }
            })
        })

        console.log("------------------------------")
    })

    socket.on('error', function (err) {
        console.log(err);
    });
});

http.listen(port, ()=>{
    console.log('connected to port: ' + port)
});