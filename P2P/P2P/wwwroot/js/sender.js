const uploadSection = document.querySelector('form[action="/Home/StartSharing"]');
const sharingSection = document.querySelector('.text-center:has(.bg-warning-soft)');

// Initially hide sharing section
sharingSection.style.display = 'none';

// File handling functions for drag & drop and displaying files remain unchanged
function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        displayFiles(files);
    } else {
        // Clear display if no files are selected
        clearFileDisplay();
    }
}

function displayFiles(files) {
    const container = document.getElementById('selected-files');
    container.innerHTML = '';

    Array.from(files).forEach((file, index) => {
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);

        const fileElement = document.createElement('div');
        fileElement.className = 'border rounded p-3 d-flex align-items-center justify-content-between mb-2';
        fileElement.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i data-lucide="file" class="opacity-75" style="width: 20px; height: 20px;"></i>
                <span class="small" style="overflow-wrap:anywhere">${file.name}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="text-end text-muted smaller">(${fileSize} MB)</span>
                <button type="button" class="btn btn-link p-0 text-muted" onclick="removeFile(this, ${index})">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        `;

        container.appendChild(fileElement);
        lucide.createIcons({ parent: fileElement });
    });

    document.getElementById('selected-files-container').classList.toggle('d-none', files.length === 0);
}

function removeFile(button, index) {
    const fileInput = document.getElementById('file-upload');
    const container = document.getElementById('selected-files');

    // Convert FileList to Array and remove the file at index
    const filesArray = Array.from(fileInput.files);
    filesArray.splice(index, 1);

    // Create new FileList-like object
    const newFileList = new DataTransfer();
    filesArray.forEach(file => newFileList.items.add(file));

    // Update the file input
    fileInput.files = newFileList.files;

    // Update display
    if (fileInput.files.length > 0) {
        displayFiles(fileInput.files);
    } else {
        clearFileDisplay();
    }
}

function clearFileDisplay() {
    const container = document.getElementById('selected-files');
    container.innerHTML = '';
    document.getElementById('selected-files-container').classList.add('d-none');
}

// Drag and drop handling
const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-warning');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-warning');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-warning');

    if (e.dataTransfer.files.length > 0) {
        document.getElementById('file-upload').files = e.dataTransfer.files;
        displayFiles(e.dataTransfer.files);
    }
});

let senderFiles = null; // Array of files to send
let currentFileIndex = 0; // Index of the current file
let currentFile = null; // Current file being sent
let currentFileSize = 0; // Size of the current file

// When the user clicks "Start Sharing", setupLink() and startConnection()
uploadSection.addEventListener('submit', (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-upload');
    if (fileInput.files.length > 0) {
        // Assign the selected file to be sent
        senderFiles = Array.from(fileInput.files);
        currentFileIndex = 0;
        currentFile = senderFiles[0];
        currentFileSize = currentFile.size;

        // Hide the upload section and show the sharing UI
        uploadSection.style.display = 'none';
        sharingSection.style.display = 'block';

        setupLink();
        startConnection(); // Use separate startConnection function
    } else {
        alert("Please select a file to share.");
    }
});



//======================================================================



// Initialize SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/fileTransferHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let peerConnection, dataChannel, myConnectionId, sessionId;

let fileReader = new FileReader();
const chunkSize = 16384; // 16KB chunk size for file data
let sentSize = 0;

// =================================================
// Sender Setup for SignalR and WebRTC File Transfer
// =================================================

// Unified progress and speed update function for sender
function updateProgress(current, total, currentFileIndex, totalFiles) {
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    const statsElement = document.getElementById('transfer-stats');
    const fileNameElement = document.getElementById('file-name');
    const fileNumberElement = document.getElementById('file-number');

    if (total > 0) {
        // Calculate progress
        const progress = (current / total) * 100;

        // Update progress bar and percentage
        requestAnimationFrame(() => {
            progressBar.style.width = `${progress}%`;
            progressPercentage.textContent = `${Math.round(progress)}%`;
        });

        // Calculate and display transfer speed
        const currentTime = Date.now();
        if (!window.transferStartTime) {
            window.transferStartTime = currentTime;
        }

        const elapsedTime = (currentTime - window.transferStartTime) / 1000; // in seconds
        const speed = (current / (1024 * 1024)) / elapsedTime; // MB/s

        // Update transfer stats
        statsElement.textContent = `( ${speed.toFixed(2)} MB/s )`;
        fileNameElement.textContent = currentFile.name;
        fileNumberElement.textContent = `(${currentFileIndex + 1}/${totalFiles})`;

        // If transfer is complete
        if (current >= total && currentFileIndex === totalFiles - 1) {
            progressBar.classList.remove('progress-bar-animated');
            statsElement.textContent = `( ${totalFiles} file(s) sent, total ${(total / (1024 * 1024)).toFixed(2)} MB )`;
            fileNameElement.textContent = '';
            fileNumberElement.textContent = '';
            console.log("Transfer completed");
        }
    }
}

// Generate a random session ID (used as the share code)
function generateSessionId() {
    return 'xxxx-xxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
}

// Setup Share Link on Sender UI
function setupLink() {
    // Generate sessionId to make a Group on SignalR and get share link
    sessionId = generateSessionId();
    // Update the UI share link
    const shareCodeElement = document.getElementById('share-link');
    shareCodeElement.textContent = `${window.location.origin}/Home/Index?sessionId=${sessionId}`;
    console.log(`${window.location.origin}/Home/Index?sessionId=${sessionId}`);

    // Show QR code for convenience
    new QRCode(document.getElementById("qrcode"), {
        text: `${window.location.origin}/Home/Index?sessionId=${sessionId}`,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Move metadata sending to a separate function that uses SignalR
function sendFileMetadataViaSignalR() {
    const filesMetadata = senderFiles.map((file, index) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        fileIndex: index,
        totalFiles: senderFiles.length
    }));

    const metadataPackage = {
        type: 'metadata',
        files: filesMetadata,
        totalSize: senderFiles.reduce((acc, file) => acc + file.size, 0)
    };
    
    console.log("Sending metadata via SignalR", metadataPackage);
    connection.invoke("SendMetadata", sessionId, metadataPackage)
        .catch(err => console.error("Error sending metadata:", err));
}

// Setup the sender's WebRTC connection and data channel
function setupSender() {
    if (peerConnection) return; // Prevent re-setup

    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // Create data channel for file transfer
    dataChannel = peerConnection.createDataChannel("fileTransfer");
    console.log("dataChannel Created")
    dataChannel.onopen = () => {
        console.log("Data channel opened, starting file transfer.");
        sendFiles();
    };
    dataChannel.onclose = () => {
        cleanup();
        console.log("Data channel closed.");
    }

    // ICE candidate gathering
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('New ICE candidate found' + event.candidate);
            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ice: event.candidate}));
        }
    };

    // Create and send the offer for WebRTC negotiation
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            console.log("Offer created, setLocalDescription and sending to Peer");
            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({sdp:peerConnection.localDescription}));
        })
        .catch(err => console.error("Error creating offer:", err));
}

// Read and send the files in chunks over the data channel
function sendFiles() {
    currentFile = senderFiles[currentFileIndex];
    currentFileSize = currentFile.size;
    sentSize = 0;

    // First, send current file metadata so the receiver knows the file details
    const metadata = JSON.stringify({
        name: currentFile.name,
        size: currentFile.size,
        type: currentFile.type,
        fileIndex: currentFileIndex,
        totalFiles: senderFiles.length
    });
    dataChannel.send(metadata);

    // Now start reading and sending file chunks
    let offset = 0;
    fileReader.onload = (event) => {
        dataChannel.send(event.target.result);
        offset += event.target.result.byteLength;
        sentSize = offset;
        updateProgress(sentSize, currentFileSize, currentFileIndex, senderFiles.length);

        if (offset < currentFileSize) {
            setTimeout(() => readSlice(offset), 100); // TODO: remove timeout
        } else {
            console.log(`File ${currentFileIndex + 1} ${currentFile.name} transfer completed`);
            currentFileIndex++;
            if (currentFileIndex < senderFiles.length) {
                // Start sending next file
                setTimeout(() => sendFiles(), 100); // Small delay between files
            } else {
                console.log("All files transferred");
            }
        }
    };

    const readSlice = (o) => {
        const slice = currentFile.slice(o, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };

    readSlice(0);
}

// ==========================
// Common Signalling Function
// ==========================

// Handle incoming signals for negotiation (offer/answer/ICE)
function handleSignal(signal, senderId) {
    if (senderId === myConnectionId) return; // Ignore self-sent signals
    const data = JSON.parse(signal);
    if (data.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
            .then(() => {
                console.log(data.sdp.type + "Received and set RemoteDescription()");
                if (data.sdp.type === "offer") {
                    peerConnection.createAnswer()
                        .then(answer => peerConnection.setLocalDescription(answer))
                        .then(() => {
                            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({sdp:peerConnection.localDescription}));
                        });
                }
            })
            .catch(err => console.error("Error setting remote description:", err));
    } else if (data.ice) {
        console.log("Received Peer-sent ICE candidate. Adding to pool.")
        peerConnection.addIceCandidate(new RTCIceCandidate(data.ice))
            .catch(err => console.error("Error adding ICE candidate:", err));
    }
}

// ========================
// SignalR Connection Start
// ========================
function startConnection() {
    connection.start()
        .then(() => {
            myConnectionId = connection.connectionId;
            console.log("SignalR connected. My Connection ID:", myConnectionId);
            connection.invoke("JoinSession", sessionId)
                .catch(err => console.error("Error joining session:", err));
        })
        .then(() => {
            console.log("Sender joined session:", sessionId);
            // Wait for the recipient to join
            connection.on("PeerJoined", (peerId) => {
                if (peerId !== myConnectionId) {
                    console.log(`Recipient ${peerId} joined session ${sessionId}`);
                    sendFileMetadataViaSignalR(); // Send metadata only after peer joins
                }
            });

            connection.on("TransferApproved", () => {
                console.log("Transfer approved, starting WebRTC connection");
                setupSender(); // Only setup WebRTC after approval
            });
        })
        .catch(err => console.error("SignalR connection error:", err));
}

// Listen for incoming signals from the hub
connection.on("ReceiveSignal", (signal, senderId) => {
    handleSignal(signal, senderId);
});

function cleanup() {
    if(peerConnection)
        peerConnection.close();
    if (dataChannel)
        dataChannel.close();
    console.log("PeerConnection and DataChannel closed.");
    peerConnection = null;
    dataChannel = null;
    // Reset other state variables
    senderFiles = null;
    currentFileIndex = 0;
    currentFile = null;
    currentFileSize = 0;
    sentSize = 0;
    window.transferStartTime = null;
}

// Cancel transfer and reload the page
function resetSharing() {
    cleanup();
    window.location.reload();
}