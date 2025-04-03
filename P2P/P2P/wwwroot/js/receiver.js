let fileModal;

// File Download Confirmation Modal
document.addEventListener('DOMContentLoaded', () => {
    fileModal = new bootstrap.Modal(document.getElementById('fileConfirmModal'), {
        backdrop: 'static',
        keyboard: false
    });
});


// Initialize SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/fileTransferHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let peerConnection, dataChannel, myConnectionId, sessionId;

let receivedFile = null;
let receivedFileSize = 0;
let receivedFiles = [];
let receivedFileIndex = null;
let allFilesMetadata = null;

// ====================================================
// Recipient Setup for SignalR and WebRTC File Transfer
// ====================================================

// Update progress function to show multiple file progress
function updateRecipientProgress(current, total, currentFileIndex, totalFiles) {
    const progressBar = document.getElementById('recipient-progress-bar');
    const progressPercentage = document.getElementById('recipient-progress-percentage');
    const statsElement = document.getElementById('recipient-transfer-stats');
    const fileNameElement = document.getElementById('file-name');
    const fileNumberElement = document.getElementById('file-number');

    if (total > 0) {
        const progress = (current / total) * 100;
        requestAnimationFrame(() => {
            progressBar.style.width = `${progress}%`;
            progressPercentage.textContent = `${Math.round(progress)}%`;
        });

        const currentTime = Date.now();
        if (!window.transferStartTime) {
            window.transferStartTime = currentTime;
        }

        const elapsedTime = (currentTime - window.transferStartTime) / 1000;
        const speed = (current / (1024 * 1024)) / elapsedTime;

        statsElement.textContent = `( ${speed.toFixed(2)} MB/s )`;
        fileNameElement.textContent = allFilesMetadata.files[currentFileIndex].name;
        fileNumberElement.textContent = `(${currentFileIndex + 1}/${totalFiles})`;

        if (current >= total && currentFileIndex === totalFiles - 1) {
            progressBar.classList.remove('progress-bar-animated');
            statsElement.textContent = `( ${totalFiles} file(s) received, total ${(total / (1024 * 1024)).toFixed(2)} MB )`;
            document.getElementById('recipient-file').textContent = 'Transfer Complete';
            fileNameElement.textContent = '';
            fileNumberElement.textContent = '';
            console.log("Transfer completed");
        }
    }
}

let receivedChunks;
// Function to set up the recipient's WebRTC connection
function setupRecipient() {
    if (peerConnection) return; // Prevent multiple setups

    peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    console.log("PeerConnection created for recipient:", peerConnection);

    // Handle incoming data channel from the sender
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        console.log("Data channel received:", dataChannel);
        let metadataReceived = false;
        let receivedSize = 0;
        receivedChunks = [];

        dataChannel.onmessage = (event) => {
            if (!metadataReceived && typeof event.data === 'string') { //JSON string
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'metadata') {
                        metadataReceived = true;
                    }
                } catch (error) {
                    console.error("Error parsing file metadata:", error);
                }
            } else {
                receivedChunks.push(event.data);
                const chunkSize = event.data.byteLength || event.data.size || 0;
                receivedSize += chunkSize;

                // Get current file metadata from allFilesMetadata
                const currentFile = allFilesMetadata.files[receivedFileIndex];
                updateRecipientProgress(receivedSize, currentFile.size, receivedFileIndex, allFilesMetadata.files.length);

                if(receivedSize >= currentFile.size) {
                    const fileBlob = new Blob(receivedChunks, { type: currentFile.type });

                    // Automatically download the completed file
                    const url = URL.createObjectURL(fileBlob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = currentFile.name;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(url);

                    // Store file info if needed
                    receivedFiles.push({
                        blob: fileBlob,
                        name: currentFile.name,
                        type: currentFile.type
                    });

                    // Reset for next file
                    receivedChunks = [];
                    receivedSize = 0;
                    // Update fileIndex for next file
                    receivedFileIndex++;

                    if (receivedFileIndex === allFilesMetadata.files.length) {
                        // All files received
                        console.log("All files downloaded");
                        dataChannel.close();
                    }
                }
            }
        };

        dataChannel.onopen = () => console.log("Data channel opened for recipient.");
        dataChannel.onclose = () => console.log("Data channel closed for recipient.");
    };


    // ICE candidate gathering
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('New ICE candidate found:', event.candidate);
            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ice: event.candidate}));
        }
    };
}

// New function to show file confirmation modal
function showFileConfirmationModal(files, totalSize) {
    const filesList = document.getElementById('modal-files-list');

    // Update modal title
    document.getElementById('fileConfirmModalLabel').textContent =
        files.length > 1 ? 'Incoming Files' : 'Incoming File';

    // Create files list HTML
    filesList.innerHTML = files.map((file, index) => `
        <div class="border rounded p-3 d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2">
                <i data-lucide="file" class="opacity-75" style="width: 20px; height: 20px;"></i>
                <span class="small" style="overflow-wrap: anywhere">${file.name}</span>
            </div>
            <span class="text-muted smaller">(${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
        </div>
    `).join('');

    // Add total size information
    filesList.innerHTML += `
        <div class="text-muted small mt-3">
            Total: ${files.length} file${files.length > 1 ? 's' : ''} 
            (${(totalSize / (1024 * 1024)).toFixed(2)} MB)
        </div>
    `;

    // Update Lucide icons
    lucide.createIcons({ parent: filesList });

    // Show the modal
    fileModal.show();
}

// Upon acceptTransfer called from modal
function acceptTransfer() {
    fileModal.hide();
    receivedFileIndex = 0; // Start with first file

    console.log("Sending metadata via SignalR"); 
    // Send approval to sender via SignalR
    connection.invoke("ApproveTransfer", sessionId)
        .catch(err => console.error("Error Approving Transfer:", err));
}

// Upon rejectTransfer called from modal
function rejectTransfer() {
    // cleanup
    receivedFileIndex = null;
    receivedFiles = [];
    receivedChunks = [];
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
    // reset
    window.location.href = `${window.location.origin}/Home/Index`;
}

// Function to show download options
//function showDownloadButton() {
//    const downloadLink = document.getElementById("downloadLink");
//    if (receivedFiles.length === 1) {
//        const file = receivedFiles[0];
//        downloadLink.href = URL.createObjectURL(file.blob);
//        downloadLink.download = file.name;
//    } else {
//        // We'll handle multiple files later with JSZip
//        downloadLink.onclick = () => {
//            // ZIP download logic will go here
//        };
//    }
//    downloadLink.style.display = "block";
//}

// ==========================
// Common Signalling Function
// ==========================

// Handle incoming signals for negotiation (offer/answer/ICE)
function handleSignal(signal, senderId) {
    if (senderId === myConnectionId) return; // Ignore self-sent signals

    try {
        // Log the raw signal for debugging
        console.log('Raw signal received:', signal);

        const data = JSON.parse(signal);

        if (data.sdp) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                .then(() => {
                    console.log(`${data.sdp.type} received and set RemoteDescription()`);
                    if (data.sdp.type === "offer") {
                        return peerConnection.createAnswer();
                    }
                })
                .then(answer => {
                    if (answer) {
                        return peerConnection.setLocalDescription(answer);
                    }
                })
                .then(() => {
                    if (data.sdp.type === "offer") {
                        console.log("Answer created, setLocalDescription and sending to Peer");
                        return connection.invoke("SendSignal", sessionId, myConnectionId,
                            JSON.stringify({ sdp: peerConnection.localDescription }));
                    }
                })
                .catch(err => console.error("Error in SDP handling:", err));
        } else if (data.ice) {
            console.log("Received Peer-sent ICE candidate. Adding to pool.");
            peerConnection.addIceCandidate(new RTCIceCandidate(data.ice))
                .catch(err => console.error("Error adding ICE candidate:", err));
        }
    } catch (error) {
        console.error('Error parsing signal:', error);
        console.error('Problematic signal:', signal);
        // Continue execution despite the error
    }
}

// ========================
// SignalR Connection Start
// ========================

connection.start()
    .then(() => {
        myConnectionId = connection.connectionId;
        console.log("SignalR connected. My Connection ID:", myConnectionId);
        const urlParams = new URLSearchParams(window.location.search);
        sessionId = urlParams.get("sessionId");
        console.log("Extracted sessionId from URL:", sessionId);
        // Join the session via the SignalR hub
        connection.invoke("JoinSession", sessionId)
            .catch(err => console.error("Error joining session:", err));
    })
    .then(() => {
        console.log("Peer joined successfully...\nWaiting to receive file metadata");
        // Wait for metadata to be received
        connection.on("ReceiveMetadata", (metadata) => {
            allFilesMetadata = metadata;
            showFileConfirmationModal(metadata.files, metadata.totalSize);
        });

        connection.on("TransferApproved", () => {
            console.log("Transfer approved, starting WebRTC connection");
            setupRecipient(); // setup WebRTC after giving approval
        });
    })
    .catch(err => console.error("SignalR connection error:", err));

connection.on("ReceiveSignal", (signal, senderId) => {
    handleSignal(signal, senderId);
});