import { AGORA_APP_ID } from "./env.js";


let currentUserStream;
let remoteUserStream;
let peerConnection;

let client;
let channel;

//Agora.io Config

let APP_ID = AGORA_APP_ID;
let token = null;
let uid = String(Math.floor(Math.random()*10000));

let queryString = window.location.search;
let queryParams = new URLSearchParams(queryString);
let roomId = queryParams.get("room");

if(!roomId){
    window.location = `lobby.html`;
}

// Setting the stun servers 
let servers = {
    iceServers : [
        {
            urls : ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
        }
    ]
}

let constraints = {
    video : {
       width : {
        min : 640,
        ideal : 1920,
        max : 1920 
       },
       height : {
        min : 480,
        ideal : 1080,
        max : 1080
       }
    },
    audio : true
}

let init = async() => {

    //Initializing client and channel from Agora Real-Time Messaging (RTM)

    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid, token});

    channel = await client.createChannel(roomId);
    await channel.join();

    channel.on("MemberJoined", handleMemberJoined);
    
    channel.on("MemberLeft", handleMemberLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)

    currentUserStream = await navigator.mediaDevices.getUserMedia(constraints);
    let currentUserMediaPlayer = document.getElementById("current-user");
    if(currentUserMediaPlayer){
        currentUserMediaPlayer.srcObject = currentUserStream;
    }
    else{
        console.err("Cannot detect Current User's properties!")
    }
}

let handleMemberJoined = (userId)=> {
    console.log("A new user joined with id", userId);
    createOffer(userId);
}

let handleMemberLeft = (userId) => {
    let remoteUserMediaPlayer = document.getElementById("remote-user");
    if(remoteUserMediaPlayer){
        remoteUserMediaPlayer.style.display = "none";
    }
    else{
        console.err("Cannot detect Remote User's properties!")
    }
    let currentUserMediaPlayer = document.getElementById("current-user");
    if(currentUserMediaPlayer){
        currentUserMediaPlayer.classList.remove("smallFrame");
    }
    else{
        console.err("Cannot detect Current User's properties!")
    }
}

let handleMessageFromPeer = async(message, userId) => {
    
    
    message = JSON.parse(message.text);

    if(message.type === "offer"){
        await createAnswer(userId, message.offer);
    }

    if(message.type === "answer"){
        await addAnswer(message.answer);
    }

    if(message.type === "candidate"){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let createPeerConnection = async(userId) => {
    peerConnection = new RTCPeerConnection(servers);
    remoteUserStream = new MediaStream();
    let remoteUserMediaPlayer = document.getElementById("remote-user");
    if(remoteUserMediaPlayer){
        remoteUserMediaPlayer.srcObject = remoteUserStream;
        remoteUserMediaPlayer.style.display = "block";
    }
    else{
        console.err("Cannot detect Remote User's properties!")
    }
    let currentUserMediaPlayer = document.getElementById("current-user");
    if(currentUserMediaPlayer){
        currentUserMediaPlayer.classList.add("smallFrame");
    }
    else{
        console.err("Cannot detect Current User's properties!");
    }

    if(!currentUserStream){
        currentUserStream = await navigator.mediaDevices.getUserMedia({video : true, audio : true});
        let currentUserMediaPlayer = document.getElementById("current-user");
        if(currentUserMediaPlayer){
            currentUserMediaPlayer.srcObject = currentUserStream;
        }
    }

    //Adding the tracks of local Media Stream to Peer Connection for the remote server to listen to it
    currentUserStream.getTracks().forEach((track)=> {
        peerConnection.addTrack(track, currentUserStream);
    })

    // If there are any tracks from remote Media Stream, adding those tracks
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track)=> {
            remoteUserStream.addTrack(track);
        })
    }

    // Catching Ice Candidates
    peerConnection.onicecandidate = async(event) =>{
        if(event.candidate){
            client.sendMessageToPeer({text : JSON.stringify({type : "candidate", "candidate" : event.candidate})}, userId);
        }
    }
}

let createOffer = async(userId) => {
    await createPeerConnection(userId);

    let connectionOffer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(connectionOffer);

    client.sendMessageToPeer({text : JSON.stringify({type : "offer", offer : connectionOffer})}, userId);
}

let createAnswer = async(userId, offer) => {
    await createPeerConnection(userId);

    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text : JSON.stringify({type : "answer", answer : answer})}, userId);

}

let addAnswer = async(answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer);
    }
}

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
}

let toggleCamera = async() => {
    let videoTrack = currentUserStream.getTracks().find(track=> track.kind === 'video');

    if(videoTrack.enabled){
        videoTrack.enabled = false;
        document.getElementById("camera-btn").style.backgroundColor = "white";
        document.getElementsByClassName("fa-camera")[0].style.color = "black";
    }
    else{
        videoTrack.enabled = true;
        document.getElementById("camera-btn").style.backgroundColor = "black";
        document.getElementsByClassName("fa-camera")[0].style.color = "white";
    }
}

let toggleMic = async() => {
    let audioTrack = currentUserStream.getTracks().find(track=> track.kind === 'audio');

    if(audioTrack.enabled){
        audioTrack.enabled = false;
        document.getElementById("mic-btn").style.backgroundColor = "white";
        document.getElementsByClassName("fa-microphone")[0].style.color = "black";
    }
    else{
        audioTrack.enabled = true;
        document.getElementById("mic-btn").style.backgroundColor = "black";
        document.getElementsByClassName("fa-microphone")[0].style.color = "white";
    }
}

window.addEventListener("beforeunload", leaveChannel);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);

init();