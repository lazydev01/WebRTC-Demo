let joinRoomForm = document.getElementById("join-room-form");
if(joinRoomForm){
    joinRoomForm.addEventListener("submit", (e)=>{
        e.preventDefault();
        let roomName = e.target['room-name'].value;
        window.location = `index.html?room=${roomName}`;
    })
}