const express = require('express');
const app = express()
const http = require('http').Server(app)
const socketio = require('socket.io');
const CryptoJS = require("crypto-js");

var url = "mongodb://localhost:27017";
var MongoClient = require('mongodb').MongoClient;
// 
var db;
// Initialize connection once
MongoClient.connect(url, {useUnifiedTopology: true}, function(err, database) {
    if(err) throw err;
    db = database.db('canvasdb'); // creating a connection to the database named 'canvasdb'
});

const port = 5000;
//Bind socket.io socket to http server
const io = socketio(http);

var usersConnected = 0;
//store incoming canvas in database and send canvas to users connected
function initCanvas(roomKey, currentCanvas, socket) {    

    let cipherCanvases = [];
    for (let i = 0; i < currentCanvas.canvas.length; i++) {
        let cipherObject = CryptoJS.AES.encrypt(JSON.stringify(currentCanvas.canvas[i]), 'secret key 123').toString();
        cipherCanvases.push(cipherObject);
    }

    let canvasData = {
        createdAt: new Date(),
        room: roomKey,
        canvas: cipherCanvases,
        lowerCanvasDataURLs: currentCanvas.lowerCanvasDataURLs,
        pageCount: currentCanvas.pageCount,
        pageHeight: currentCanvas.pageHeight,
        pageWidth: currentCanvas.pageWidth
    }

    db.collection("canvases").insertOne( canvasData, function(err, res) {
        if (err) throw err;
        console.log("1 document inserted");

        canvasData.canvas = currentCanvas.canvas;
        socket.emit('canvasSetup', canvasData);

        db.collection("canvases").createIndex( { "createdAt": 1 }, { expireAfterSeconds: 86400 } )
    });

}

//define socket.io behavior when users connect
io.on('connection', (socket)=>{

    //check if database has canvas if not request it, if it does send it to users
    socket.emit('join');
    socket.on('join', ({ username, roomKey, joining }) => {
        socket.join(roomKey);
        console.log(socket.rooms)
        console.log(`${username} just joined ${roomKey}`)
        usersConnected++;
        console.log(`current number of users in ${roomKey}: ${usersConnected}`);

        db.collection("canvases").findOne({ room: roomKey }, function(err, result) {
            if (err) throw err;
            if (result !== null) {

                for (let i = 0; i < result.canvas.length; i++) {
                    let bytes  = CryptoJS.AES.decrypt(result.canvas[i], 'secret key 123');
                    result.canvas[i] = (JSON.parse(bytes.toString(CryptoJS.enc.Utf8)));
                }

                console.log(`fetching canvas data from room name: ${roomKey}`)
                socket.emit('canvasSetup', result);
            } else if (!joining) {
                console.log(`initial setup for room name: ${roomKey}`)
                socket.emit('needCanvas');
            } else {
                socket.emit('invalidRoomCode')
            }
        });
    
        //force reset canvas, only gets called when 'needCanvas' gets emitted
        socket.on('initCanvas', function(data, callback) {
            initCanvas(roomKey, data.currentCanvas, socket);
            callback();
        });
    
        //force send clients canvas that are missing it
        socket.on('missingCanvas', (data) => {
            socket.emit('canvasSetup', canvasData);
        })

        socket.on('requestPage', (id) => {
            db.collection("canvases").findOne({room: roomKey}, function(err, result) {
                if (err) throw err;

                if (result === null) {
                    socket.emit('invalidRoomCode');
                } else {
                    let bytes  = CryptoJS.AES.decrypt(result.canvas[id], 'secret key 123');

                    let decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

                    let pageData = {
                        id: id,
                        canvas: decryptedData
                    }
                    socket.emit('sendPage', pageData);
                }
            });
        })

        // for Downloads only (currently)
        socket.on('requestCanvasData', () => {
            console.log("PERFORMING requestCanvasData")
            db.collection("canvases").findOne({room: roomKey}, function(err, result) {
                if (err) throw err;

                for (let i = 0; i < result.pageCount; i++) {
                    const bytes = CryptoJS.AES.decrypt(result.canvas[i], 'secret key 123');
                    result.canvas[i] = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                }
                socket.emit('sendCanvasData', {
                    canvas: result.canvas,
                    lowerCanvasDataURLs: result.lowerCanvasDataURLs, 
                    pageCount: result.pageCount,
                    pageWidth: result.pageWidth,
                    pageHeight: result.pageHeight
                })
            })
        })

        //receive incoming changes to the canvases and save the changes in the database. after saving, send edited canvas to users who did not send changes
        socket.on('editIn', (data) => {
            db.collection("canvases").findOne({room: roomKey}, function(err, result) {
                if (err) throw err;

                let cipherObject = CryptoJS.AES.encrypt(JSON.stringify(data.canvasData.canvasJson), 'secret key 123').toString();
                result.canvas[data.canvasData.id] = cipherObject;
                result.lowerCanvasDataURLs[data.canvasData.id] = data.canvasData.canvasDataURL;

                db.collection("canvases").updateOne({room: roomKey}, {$set: {canvas: result.canvas, lowerCanvasDataURLs: result.lowerCanvasDataURLs}}, function(err, res) {
                    if (err) throw err;
                    console.log("1 document updated");
    
                    let dataOut = {
                        json: data.canvasData.json,
                        id: data.canvasData.id,
                        action: data.canvasData.action
                    };

                    socket.broadcast.to(roomKey).emit('editOut', dataOut);
                });
            });
        })

        socket.on('deleteIn', (data) => {
            db.collection("canvases").findOne({room: roomKey}, function(err, result) {
                if (err) throw err;

                let cipherObject = CryptoJS.AES.encrypt(JSON.stringify(data.canvasData.canvasJson), 'secret key 123').toString();
                result.canvas[data.canvasData.id] = cipherObject;
                result.lowerCanvasDataURLs[data.canvasData.id] = data.canvasData.canvasDataURL

                db.collection("canvases").updateOne({room: roomKey}, {$set: {canvas: result.canvas, lowerCanvasDataURLs: result.lowerCanvasDataURLs}}, function(err, res) {
                    if (err) throw err;
                    console.log("1 document updated");
    
                    let dataOut = {
                        objectId: data.canvasData.objectId,
                        id: data.canvasData.id,
                        action: data.canvasData.action
                    };

                    socket.broadcast.to(roomKey).emit('deleteOut', dataOut);
                });
            });
        })

        // socket.on('editIn', (data) => {
        //     db.collection("canvases").findOne({}, function(err, result) {
        //         if (err) throw err;
        
        //         result.canvas[data.canvasData.id] = data.canvasData.json;
    
        //         db.collection("canvases").updateOne({}, {$set: {canvas: result.canvas}}, function(err, res) {
        //             if (err) throw err;
        //             console.log("1 document updated");
    
        //             let dataOut = {
        //                 json: data.canvasData.json,
        //                 id: data.canvasData.id
        //             };
        //             socket.to(data.roomKey).emit('editOut', dataOut); 
        //         });
        //     });
        // })

        socket.on("disconnect", ()=>{
            console.log(`${username} just left ${roomKey}`);
            usersConnected--;
            console.log(`current number of users in ${roomKey}: ${usersConnected}`);
        })

        console.log("------------------------------")
    })

    // socket.on("disconnect", ()=>{
    //     usersConnected--;
    //     console.log('user connected');
    //     // const user = removeUser(socket.id);
    //     // if (user) {
    //     //     socket.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left`})
    //     // }
    // })

    socket.on('error', function (err) {
        console.log(err);
    });
});

http.listen(port, ()=>{
    console.log('connected to port: ' + port)
});