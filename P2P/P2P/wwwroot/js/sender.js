// --- START OF FILE sender.js ---

document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const uploadSection = document.getElementById('sender-upload-section');
    const sharingSection = document.getElementById('sender-sharing-section');
    const senderForm = document.getElementById('sender-form'); // Reference the form itself
    const fileUploadInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('dropZone');
    const selectedFilesContainer = document.getElementById('selected-files-container');
    const selectedFilesDiv = document.getElementById('selected-files');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    const statsElement = document.getElementById('transfer-stats');
    const currentFileNameElement = document.getElementById('sender-file-name'); // Unique ID
    const fileNumberElement = document.getElementById('sender-file-number');   // Unique ID
    const shareCodeElement = document.getElementById('share-link');
    const qrCodeElement = document.getElementById('qrcode');
    const cancelBtn = document.getElementById('cancel-transfer-btn');
    const sendAgainBtn = document.getElementById('send-again-btn');
    const sharingStatusTitle = document.getElementById('sharing-status-title');
    const progressLabel = document.getElementById('progress-label');

    // State Variables
    let senderFiles = null; // Array of File objects
    let metadataPackage = null;
    let currentFileIndex = 0;
    let currentFile = null; // File object
    let currentFileSize = 0;
    let currentFileSentSize = 0; // Sent size for the *current* file
    let totalSentSizeOverall = 0; // Track total sent across all files for overall progress/stats
    let totalSizeOverall = 0;
    let transferStartTime = null; // For speed calculation

    // State Machine Variable
    let senderState = 'idle'; // idle, waitingForPeer, negotiating, transferInProgress, transferComplete, cancelled, error

    // WebRTC & SignalR Variables
    let peerConnection = null;
    let dataChannel = null;
    let myConnectionId = null;
    let connectedPeerId = null; // The specific peer we are transferring to
    let sessionId = null;
    let fileReader = new FileReader();
    const chunkSize = 16 * 1024; // 16KB

    // Initialize SignalR Connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/fileTransferHub")
        .configureLogging(signalR.LogLevel.Information) // Change level for production
        .build();

    // --- UI Initialization and File Handling ---

    // Initial UI state set via HTML style="display: none;" now
    setState('idle'); // Ensure initial state logic runs

    function handleFileSelect(event) {
        const files = event.target.files;
        if (files && files.length > 0) {
            displayFiles(files);
        } else {
            clearFileDisplay();
        }
    }

    function displayFiles(files) {
        if (!selectedFilesDiv || !selectedFilesContainer) return;
        selectedFilesDiv.innerHTML = ''; // Clear previous entries
        const fileArray = Array.from(files);

        fileArray.forEach((file, index) => {
            const fileSize = formatBytes(file.size); // Use formatBytes
            const fileElement = document.createElement('div');
            fileElement.className = 'border rounded p-3 d-flex align-items-center justify-content-between mb-2';
            fileElement.innerHTML = `
                <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                    <i data-lucide="file" class="opacity-75 flex-shrink-0" style="width: 20px; height: 20px;"></i>
                    <span class="small text-truncate" style="overflow-wrap:anywhere" title="${file.name}">${file.name}</span>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    <span class="text-end text-muted smaller">(${fileSize})</span>
                    <button type="button" class="btn btn-link p-0 text-muted remove-file-btn" data-index="${index}">
                        <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
            `;
            selectedFilesDiv.appendChild(fileElement);
        });

        // Add event listeners to new remove buttons
        selectedFilesDiv.querySelectorAll('.remove-file-btn').forEach(button => {
            button.addEventListener('click', () => {
                removeFile(parseInt(button.getAttribute('data-index')));
            });
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ parent: selectedFilesDiv });
        }

        selectedFilesContainer.classList.toggle('d-none', fileArray.length === 0);
    }

    function removeFile(indexToRemove) {
        if (!fileUploadInput) return;
        const currentFiles = Array.from(fileUploadInput.files);
        currentFiles.splice(indexToRemove, 1); // Remove the file

        const newFileList = new DataTransfer();
        currentFiles.forEach(file => newFileList.items.add(file));
        fileUploadInput.files = newFileList.files;

        displayFiles(fileUploadInput.files); // Refresh the display
    }

    function clearFileDisplay() {
        if (selectedFilesDiv) selectedFilesDiv.innerHTML = '';
        if (selectedFilesContainer) selectedFilesContainer.classList.add('d-none');
        if (fileUploadInput) fileUploadInput.value = '';
    }

    // --- Event Listeners ---

    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', handleFileSelect);
    }

    if (dropZone) {
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
            if (e.dataTransfer.files.length > 0 && fileUploadInput) {
                fileUploadInput.files = e.dataTransfer.files;
                displayFiles(e.dataTransfer.files);
            }
        });
    }
    
    if (senderForm) {
        senderForm.addEventListener('submit', handleStartSharingSubmit);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelTransfer);
    }
    if (sendAgainBtn) {
        sendAgainBtn.addEventListener('click', prepareShareAgain);
    }


    // --- State Management & UI Updates ---

    function setState(newState) {
        console.log(`Sender State Change: ${senderState} -> ${newState}`);
        senderState = newState;

        // --- UI Updates based on State ---
        requestAnimationFrame(() => {
            // Ensure elements exist
            const uploadSectionExists = !!uploadSection;
            const sharingSectionExists = !!sharingSection;
            const cancelBtnExists = !!cancelBtn;
            const sendAgainBtnExists = !!sendAgainBtn;
            const statusTitleExists = !!sharingStatusTitle;
            const progressLabelExists = !!progressLabel;

            // Default visibility
            if (cancelBtnExists) cancelBtn.style.display = 'none';
            if (sendAgainBtnExists) sendAgainBtn.style.display = 'none';
            if (uploadSectionExists) uploadSection.style.display = 'none';
            if (sharingSectionExists) sharingSection.style.display = 'none';

            switch (newState) {
                case 'idle':
                case 'error':
                    if (uploadSectionExists) uploadSection.style.display = 'block';
                    clearFileDisplay();
                    resetProgressUI();
                    break;
                case 'cancelled':
                    if (uploadSectionExists) uploadSection.style.display = 'block';
                    resetProgressUI();
                    if (currentFileNameElement) currentFileNameElement.textContent = 'Cancelled';
                    break;
                case 'waitingForPeer':
                    if (sharingSectionExists) sharingSection.style.display = 'block';
                    if (cancelBtnExists) cancelBtn.style.display = 'block';
                    if (statusTitleExists) sharingStatusTitle.textContent = 'Ready to Share!';
                    if (progressLabelExists) progressLabel.textContent = 'Waiting for receiver...';
                    resetProgressUI(); // Reset progress visually
                    if (currentFileNameElement) currentFileNameElement.textContent = '';
                    if (fileNumberElement) fileNumberElement.textContent = '';
                    break;
                case 'negotiating':
                    if (sharingSectionExists) sharingSection.style.display = 'block';
                    if (cancelBtnExists) cancelBtn.style.display = 'block';
                    if (statusTitleExists) sharingStatusTitle.textContent = 'Establishing Connection...';
                    if (progressLabelExists) progressLabel.textContent = 'Negotiating...';
                    break;
                case 'transferInProgress':
                    if (sharingSectionExists) sharingSection.style.display = 'block';
                    if (cancelBtnExists) cancelBtn.style.display = 'block';
                    if (statusTitleExists) sharingStatusTitle.textContent = 'Transfer in Progress...';
                    if (progressLabelExists) progressLabel.textContent = 'Transfer progress';
                    if (progressBar) {
                        progressBar.classList.remove('bg-success');
                        progressBar.classList.add('progress-bar-animated', 'bg-warning');
                    }
                    break;
                case 'transferComplete':
                    if (sharingSectionExists) sharingSection.style.display = 'block';
                    if (sendAgainBtnExists) sendAgainBtn.style.display = 'block';
                    if (statusTitleExists) sharingStatusTitle.textContent = 'Transfer Complete!';
                    if (progressLabelExists) progressLabel.textContent = 'Completed';
                    if (progressBar) {
                        progressBar.classList.remove('progress-bar-animated', 'bg-warning');
                        progressBar.classList.add('bg-success');
                        progressBar.style.width = '100%';
                    }
                    if (progressPercentage) progressPercentage.textContent = '100%';
                    break;
            }
        });
    }

    function resetProgressUI() {
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.classList.remove('bg-success');
            progressBar.classList.add('progress-bar-animated', 'bg-warning');
        }
        if (progressPercentage) progressPercentage.textContent = '0%';
        if (statsElement) statsElement.textContent = '';
        if (currentFileNameElement) currentFileNameElement.textContent = '';
        if (fileNumberElement) fileNumberElement.textContent = '';
    }

    // --- Format bytes utility ---
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0 || !bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const index = Math.min(i, sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
    }

    // --- Core Logic: Start Sharing ---
    function handleStartSharingSubmit(e) {
        e.preventDefault(); // Already done, but safe double-check
        if (!fileUploadInput || fileUploadInput.files.length === 0) {
            showAlert("Please select at least one file to share.", "warning");
            return;
        }
        if (senderState !== 'idle' && senderState !== 'cancelled' && senderState !== 'error') {
            showAlert("Sharing session already active or finishing.", "warning");
            return;
        }

        senderFiles = Array.from(fileUploadInput.files);
        totalSizeOverall = senderFiles.reduce((acc, file) => acc + (file.size || 0), 0);

        resetSenderStateVariables(false); // Reset progress/state variables
        setupLinkAndQRCode(); // Generate session ID and update UI
        setState('waitingForPeer'); // Update state and switch UI view

        if (connection.state !== signalR.HubConnectionState.Connected) {
            startConnection();
        } else {
            joinSignalRSession();
        }
    }

    // --- WebRTC & File Transfer ---

    function setupWebRTCConnection() {
        if (peerConnection) {
            console.warn("WebRTC connection already exists. Cleaning up first...");
            cleanupWebRTC();
        }
        if (senderState !== 'negotiating') {
            console.warn("WebRTC setup called in incorrect state:", senderState);
            if (senderState === 'waitingForPeer')
                setState('negotiating'); // Attempt recovery
            else return;
        }

        console.log("Setting up WebRTC PeerConnection...");

        try {
            peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            peerConnection.onicecandidate = handleIceCandidate;
            peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange;
            peerConnection.onconnectionstatechange = handleConnectionStateChange;

            console.log("Creating DataChannel...");
            dataChannel = peerConnection.createDataChannel("fileTransfer", { ordered: true });
            dataChannel.binaryType = 'arraybuffer';
            dataChannel.onopen = handleDataChannelOpen;
            dataChannel.onclose = handleDataChannelClose;
            dataChannel.onerror = handleDataChannelError;

            console.log("Creating WebRTC offer...");
            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    console.log("Local description set, sending offer to peer", connectedPeerId?.substring(0, 6));
                    if (connectedPeerId && connection.state === signalR.HubConnectionState.Connected && peerConnection?.localDescription) {
                        connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ sdp: peerConnection.localDescription }))
                            .catch(err => console.error("Error sending offer SDP:", err));
                    } else {
                        console.error("Cannot send offer: Preconditions not met.");
                        resetSenderStateVariables(false);
                        setState('waitingForPeer');
                    }
                })
                .catch(handleWebRTCError("creating/sending offer"));

        } catch (error) {
            handleWebRTCError("setting up PeerConnection")(error);
        }
    }

    function sendNextFile() {
        if (senderState !== 'transferInProgress') {
            console.warn(`sendNextFile called in incorrect state: ${senderState}. Aborting.`);
            return;
        }
        if (currentFileIndex >= senderFiles.length) {
            console.error("sendNextFile called but index out of bounds.");
            updateSenderProgress(0, true, true); // Signal completion
            return;
        }

        currentFile = senderFiles[currentFileIndex];
        currentFileSize = currentFile ? currentFile.size || 0 : 0;
        currentFileSentSize = 0;

        if (!currentFile) {
            handleTransferError(`Error accessing file ${currentFileIndex + 1}.`)(); // Use error handler
            return;
        }

        console.log(`Starting transfer of file ${currentFileIndex + 1}/${senderFiles.length}: ${currentFile.name} (${formatBytes(currentFileSize)})`);
        updateSenderProgressUI(0); // Update UI for the new file info

        readAndSendSlice(0);
    }

    function readAndSendSlice(offset) {
        if (senderState !== 'transferInProgress' || !dataChannel || dataChannel.readyState !== 'open') {
            console.warn(`Sending slice stopped: State=${senderState}, DC=${dataChannel?.readyState}`);
            return;
        }
        if (!currentFile) {
            handleTransferError("readAndSendSlice called but currentFile is null.")();
            return;
        }
        const slice = currentFile.slice(offset, offset + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    }

    // Defined once outside the loop
    fileReader.onload = (event) => {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            console.warn("Data channel closed before processing loaded chunk.");
            return;
        }

        const chunk = event.target.result;
        if (!chunk || chunk.byteLength === 0) {
            console.warn("FileReader read empty chunk for " + currentFile?.name);
            handleTransferError(`Error reading file ${currentFile?.name}.`)();
            return;
        }

        try {
            const bufferThreshold = chunkSize * 20;
            if (dataChannel.bufferedAmount > bufferThreshold) {
                setTimeout(() => { fileReader.onload(event); }, 50);
                return;
            }

            dataChannel.send(chunk);
            const sentSizeBeforeUpdate = currentFileSentSize;
            const isEndOfCurrentFile = (sentSizeBeforeUpdate + chunk.byteLength) >= currentFileSize;

            updateSenderProgress(chunk.byteLength, isEndOfCurrentFile, false); // Update state and UI

            if (isEndOfCurrentFile) {
                console.log(`Finished sending file ${currentFileIndex + 1}: ${currentFile.name}`);
                currentFileIndex++;
                if (currentFileIndex < senderFiles.length) {
                    setTimeout(sendNextFile, 10);
                } else {
                    console.log("All files sent signal.");
                    updateSenderProgress(0, true, true); // Final update signals completion
                }
            } else {
                const nextOffset = currentFileSentSize; // Progress function updated it
                setTimeout(() => readAndSendSlice(nextOffset), 0); // Yield before reading next
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'InvalidStateError') {
                console.warn("Attempted to send on closed/null data channel.");
            } else {
                handleTransferError("Error sending data chunk:")(error);
            }
        }
    };

    fileReader.onerror = handleTransferError("FileReader error:");

    // --- Progress Update ---
    function updateSenderProgress(sentInChunk, isEndOfFile = false, isEndOfTransfer = false) {
        // Update internal state first
        currentFileSentSize += sentInChunk;
        totalSentSizeOverall += sentInChunk;

        // Update UI
        updateSenderProgressUI(sentInChunk);

        // Handle completion logic
        if (isEndOfTransfer && senderState !== 'transferComplete') {
            console.log("Processing transfer completion.");
            sendMetaData();
            setState('transferComplete'); // Set state first
            // Update final stats text after state change
            requestAnimationFrame(() => {
                if (statsElement) statsElement.textContent = `(${senderFiles.length} file(s) sent, ${formatBytes(totalSizeOverall)})`;
                if (currentFileNameElement) currentFileNameElement.textContent = 'Transfer Complete!';
                if (fileNumberElement) fileNumberElement.textContent = '';
            });
            // Close DataChannel after completion UI update attempt
            setTimeout(() => {
                if (dataChannel && dataChannel.readyState === 'open') {
                    console.log("Sender closing data channel after completion.");
                    dataChannel.close();
                }
            }, 200);
        } else if (isEndOfFile) {
            // Just log, UI updated by general progress update
            // console.log(`End of file ${currentFileIndex + 1} processed in progress update.`);
        }
    }

    // Separated UI update part of progress
    function updateSenderProgressUI(sentInChunk) {
        if (!currentFile || !progressBar || !progressPercentage || !statsElement || !currentFileNameElement || !fileNumberElement) {
            return; // Cannot update UI if elements or file info missing
        }

        const overallProgress = totalSizeOverall > 0 ? Math.min(100, (totalSentSizeOverall / totalSizeOverall) * 100) : 0;

        requestAnimationFrame(() => {
            progressBar.style.width = `${overallProgress}%`;
            progressPercentage.textContent = `${Math.round(overallProgress)}%`;

            // Only update file name/number if not complete state (setState handles final text)
            if (senderState !== 'transferComplete') {
                currentFileNameElement.textContent = currentFile.name;
                fileNumberElement.textContent = `(${currentFileIndex + 1}/${senderFiles.length})`;
            }

            // Calculate and display transfer speed (only if transfer is active)
            if (senderState === 'transferInProgress' && totalSentSizeOverall > 0) {
                const currentTime = Date.now();
                if (!transferStartTime) transferStartTime = currentTime;
                const elapsedTime = (currentTime - transferStartTime) / 1000;
                if (elapsedTime > 0.3) { // Update speed reasonably often
                    const speed = totalSentSizeOverall / (1024 * 1024) / elapsedTime; // MB/s
                    statsElement.textContent = `(${speed.toFixed(2)} MB/s)`;
                }
            }
        });
    }

    async function sendMetaData() {
        try {
            const response = await fetch('/Meta/CompleteTransfer?isSender=True', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadataPackage.files)
            });

            if (!response.ok) {
                throw new Error('Failed to send data');
            }

            const result = await response.json();
            console.log(result.message); // Output: "User John Doe with email john.doe@example.com saved successfully!"
            alert(result.message);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while sending data.');
        }
    }

    // --- WebRTC Event Handlers ---
    function handleIceCandidate(event) {
        if (event.candidate && connectedPeerId && connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ ice: event.candidate }))
                .catch(err => console.error("Error sending ICE candidate:", err));
        }
    }

    function handleIceConnectionStateChange() {
        if (!peerConnection) return;
        console.log("Sender ICE Connection State:", peerConnection.iceConnectionState);
        if ((peerConnection.iceConnectionState === 'failed' ||
            peerConnection.iceConnectionState === 'disconnected' ||
            peerConnection.iceConnectionState === 'closed') &&
            (senderState === 'transferInProgress' || senderState === 'negotiating')) {
            if (peerConnection.connectionState !== 'closed') { // Avoid double alert if connection also closed
                showAlert("Connection issue (ICE). Transfer interrupted.", "warning");
            }
            resetSenderStateVariables(false);
            setState('waitingForPeer');
        }
    }

    function handleConnectionStateChange() {
        if (!peerConnection) return;
        console.log("Sender PeerConnection State:", peerConnection.connectionState);
        if ((peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'closed') &&
            (senderState === 'transferInProgress' || senderState === 'negotiating')) {
            showAlert("Connection with receiver lost. Transfer interrupted.", "warning");
            resetSenderStateVariables(false);
            setState('waitingForPeer');
        }
    }

    function handleDataChannelOpen() {
        console.log("Data channel opened.");
        if (senderState === 'negotiating') {
            transferStartTime = Date.now();
            currentFileIndex = 0;
            totalSentSizeOverall = 0;
            setState('transferInProgress');
            sendNextFile();
        } else {
            console.warn(`Data channel opened in unexpected state: ${senderState}`);
            if (senderState !== 'transferComplete') { // If not already done, reset
                resetSenderStateVariables(false);
                setState('waitingForPeer');
            }
        }
    }

    function handleDataChannelClose() {
        console.log("Data channel closed.");
        if (senderState === 'transferInProgress' || senderState === 'negotiating') {
            showAlert("Transfer interrupted (Channel Closed).", "warning");
            resetSenderStateVariables(false);
            setState('waitingForPeer');
        }
    }

    function handleDataChannelError(errorEvent) {
        // Extract the error message if possible
        const errorMessage = errorEvent.error ? `${errorEvent.error.name}: ${errorEvent.error.message}` : 'Unknown data channel error';
        console.error("Data channel error:", errorMessage, errorEvent);
        if (senderState === 'transferInProgress' || senderState === 'negotiating') {
            showAlert(`Transfer error: ${errorMessage}`, "danger");
            resetSenderStateVariables(false);
            setState('waitingForPeer');
        }
    }

    // --- Central Error Handlers ---
    function handleTransferError(context) {
        return (error) => {
            console.error(`${context}:`, error);
            // Avoid resetting if state is already idle/cancelled/complete
            if (senderState === 'transferInProgress' || senderState === 'negotiating') {
                showAlert(`Transfer failed: ${context}.`, "danger");
                resetSenderStateVariables(false);
                setState('waitingForPeer'); // Go back to waiting
            }
        };
    }
    function handleWebRTCError(context) {
        return (error) => {
            console.error(`WebRTC Error (${context}):`, error);
            if (senderState !== 'idle' && senderState !== 'cancelled') { // Avoid alert on manual cancel/reset
                showAlert(`Connection setup failed (${context}).`, "danger");
                resetSenderStateVariables(false);
                setState('waitingForPeer');
            }
        };
    }

    // --- SignalR Event Handlers ---
    function registerSignalREventHandlers() {
        connection.off("PeerJoined"); connection.off("ReceiveSignal"); connection.off("TransferApprovedByPeer");
        connection.off("TransferRejectedByPeer"); connection.off("TransferCancelledByPeer"); connection.off("PeerDisconnected");

        connection.on("PeerJoined", (peerId) => {
            console.log(`Peer ${peerId.substring(0, 6)} joined. State: ${senderState}`);
            if (senderState === 'waitingForPeer' && !connectedPeerId) {
                connectedPeerId = peerId;
                showAlert(`Receiver ${peerId.substring(0, 6)} connected. Waiting for approval...`, 'info');
                sendFileMetadataViaSignalR(peerId);
            } else if (senderState === 'transferComplete') {
                showAlert(`User ${peerId.substring(0, 6)} joined. Click "Share Again".`, 'info');
            } else if (connectedPeerId !== peerId) { // Busy or waiting for specific peer
                console.log(`Ignoring joining peer ${peerId.substring(0, 6)}, busy/waiting.`);
                if (senderState === 'transferInProgress' || senderState === 'negotiating') {
                    showAlert(`User (${peerId.substring(0, 6)}) tried to join while busy.`, 'warning', 3000);
                }
                connection.invoke("SignalBusy", peerId).catch(err => console.error("Error sending busy signal:", err));
            }
        });

        connection.on("ReceiveSignal", (signal, senderId) => {
            if (senderId === connectedPeerId && (senderState === 'negotiating' || senderState === 'transferInProgress')) {
                handleSignalProcessing(signal);
            }
        });

        connection.on("TransferApprovedByPeer", (peerId) => {
            if (peerId === connectedPeerId && senderState === 'waitingForPeer') {
                console.log(`Transfer approved by ${peerId.substring(0, 6)}.`);
                showAlert(`Receiver ${peerId.substring(0, 6)} accepted. Starting...`, 'success');
                setState('negotiating');
                setupWebRTCConnection();
            } else {
                console.warn(`Approval from wrong peer/state. Peer: ${peerId.substring(0, 6)}, Expected: ${connectedPeerId?.substring(0, 6)}, State: ${senderState}`);
            }
        });

        connection.on("TransferRejectedByPeer", (peerId) => {
            if (peerId === connectedPeerId && (senderState === 'waitingForPeer' || senderState === 'negotiating')) {
                console.log(`Transfer rejected by ${peerId.substring(0, 6)}.`);
                showAlert(`Receiver ${peerId.substring(0, 6)} rejected the transfer.`, 'warning');
                resetSenderStateVariables(false); // Keep files
                setState('waitingForPeer');
            }
        });

        connection.on("TransferCancelledByPeer", (peerId) => {
            if (peerId === connectedPeerId) {
                console.log(`Transfer cancelled by receiver ${peerId.substring(0, 6)}.`);
                showAlert(`Receiver ${peerId.substring(0, 6)} cancelled.`, 'warning');
                resetSenderStateVariables(false); // Keep files
                setState('waitingForPeer');
            }
        });

        connection.on("PeerDisconnected", (peerId) => {
            console.log(`Peer ${peerId.substring(0, 6)} disconnected.`);
            if (peerId === connectedPeerId) {
                console.log(`Connected peer disconnected.`);
                const currentState = senderState;
                resetSenderStateVariables(false); // Keep files, clears connectedPeerId

                if (currentState === 'transferInProgress' || currentState === 'negotiating' || currentState === 'waitingForPeer') {
                    showAlert(`Receiver ${peerId.substring(0, 6)} disconnected.`, 'warning');
                    setState('waitingForPeer');
                } else if (currentState === 'transferComplete') {
                    showAlert(`Receiver ${peerId.substring(0, 6)} disconnected after transfer.`, 'info', 3000);
                    setState('transferComplete'); // Re-assert state after reset
                }
            }
        });
    }

    // --- SignalR Connection Management ---
    function startConnection() {
        if (connection.state === signalR.HubConnectionState.Connected || connection.state === signalR.HubConnectionState.Connecting) {
            console.log("SignalR connection already active or starting.");
            joinSignalRSession(); return;
        }
        console.log("Starting SignalR connection...");
        registerSignalREventHandlers();

        connection.start()
            .then(() => {
                myConnectionId = connection.connectionId;
                console.log("SignalR connected:", myConnectionId);
                joinSignalRSession();
            })
            .catch(err => {
                console.error("SignalR connection error:", err);
                showAlert("Cannot connect. Refresh.", "danger", 0);
                (true);
                setState('error');
            });

        connection.onclose((error) => {
            console.error("SignalR connection closed.", error);
            if (senderState !== 'idle' && senderState !== 'cancelled') {
                showAlert("Connection lost. Refresh.", "danger", 0);
            }
            resetSenderStateVariables(true);
            setState('error');
        });
    }

    function joinSignalRSession() {
        if (connection.state === signalR.HubConnectionState.Connected && sessionId) {
            connection.invoke("JoinSession", sessionId)
                .then(() => console.log(`Joined session ${sessionId}.`))
                .catch(err => {
                    console.error(`Error joining session ${sessionId}:`, err);
                    showAlert("Error joining session.", "danger");
                    resetSenderStateVariables(true);
                    setState('error');
                });
        } else { console.error("Cannot join session - Connection state or sessionId invalid."); /* Consider recovery or error state */ }
    }

    // --- Signal Processing ---
    function handleSignalProcessing(signal) {
        if (!peerConnection) { console.warn("Signal received but PeerConnection is null."); return; }
        try {
            const data = JSON.parse(signal);
            if (data.sdp && data.sdp.type === 'answer') {
                console.log("Received SDP Answer.");
                if (peerConnection.signalingState === 'have-local-offer' || peerConnection.signalingState === 'stable') { // Allow setting answer even if stable sometimes needed
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                        .then(() => console.log("Remote description (answer) set."))
                        .catch(handleWebRTCError("setting remote description (answer)"));
                } else { console.warn(`Received answer in unexpected signaling state: ${peerConnection.signalingState}`); }
            } else if (data.ice) {
                peerConnection.addIceCandidate(new RTCIceCandidate(data.ice))
                    .catch(err => console.warn("Error adding ICE candidate:", err)); // Usually benign
            } else { console.warn("Received unknown signal type:", data); }
        } catch (error) { console.error("Error parsing signal:", error); }
    }

    // --- Utility and Cleanup ---
    function setupLinkAndQRCode() {
        sessionId = generateSessionId();
        const shareUrl = `${window.location.origin}/Home/Index?sessionId=${sessionId}`;
        if (shareCodeElement) shareCodeElement.textContent = shareUrl;
        console.log("Share link:", shareUrl);
        if (qrCodeElement) {
            qrCodeElement.innerHTML = '';
            try { new QRCode(qrCodeElement, { text: shareUrl, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); }
            catch (e) { console.error("QR code generation failed:", e); qrCodeElement.textContent = "QR Error"; }
        }
    }

    function generateSessionId() { return Math.random().toString(16).substring(2, 8) + '-' + Math.random().toString(16).substring(2, 8); }

    function cleanupWebRTC() {
        console.log("Cleaning up sender WebRTC...");
        if (dataChannel) {
            dataChannel.onopen = null; dataChannel.onclose = null; dataChannel.onerror = null; dataChannel.onmessage = null;
            if (dataChannel.readyState === 'open' || dataChannel.readyState === 'connecting') { try { dataChannel.close(); } catch (e) { /* Ignore */ } }
            dataChannel = null;
        }
        if (peerConnection) {
            peerConnection.onicecandidate = null; peerConnection.ondatachannel = null; peerConnection.oniceconnectionstatechange = null; peerConnection.onconnectionstatechange = null;
            if (peerConnection.connectionState !== 'closed') { try { peerConnection.close(); } catch (e) { /* Ignore */ } }
            peerConnection = null;
        }
        console.log("Sender WebRTC cleanup complete.");
    }

    // Renamed to avoid conflict with setState
    function resetSenderStateVariables(clearFiles = true) {
        console.log(`Resetting sender vars (clearFiles: ${clearFiles}). Current state: ${senderState}`);
        cleanupWebRTC(); // Cleanup connections first

        // Reset transfer tracking variables
        currentFileIndex = 0; currentFile = null; currentFileSize = 0;
        currentFileSentSize = 0; totalSentSizeOverall = 0; transferStartTime = null;
        connectedPeerId = null; // Clear peer

        resetProgressUI(); // Reset visual progress elements

        if (clearFiles) {
            console.log("Clearing selected files and session info.");
            senderFiles = null; totalSizeOverall = 0;
            clearFileDisplay();
            if (qrCodeElement) qrCodeElement.innerHTML = '';
            if (shareCodeElement) shareCodeElement.textContent = '';
            sessionId = null;
            // *** IMPORTANT: Do not call setState('idle') here ***
            // The caller (e.g., cancelTransfer or error handlers) should set the final state.
        }
        console.log("Sender state variables reset.");
    }

    // --- Action Buttons ---
    function cancelTransfer() {
        console.log("User cancelled transfer.");
        const peerToNotify = connectedPeerId;
        if (peerToNotify && connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke("NotifyCancel", sessionId, peerToNotify)
                .catch(err => console.error("Error sending cancel notification:", err));
        }
        showAlert("Transfer cancelled.", "warning");
        resetSenderStateVariables(true); // Full reset (clears files, session)
        setState('idle'); // Set final state after reset
        console.log("Cancellation complete.");
    }

    function prepareShareAgain() {
        if (senderState !== 'transferComplete') { console.warn("Share Again clicked in wrong state:", senderState); return; }
        console.log("Preparing to share again...");
        showAlert("Ready for a new receiver using the same link.", "info");
        resetSenderStateVariables(false); // Keep files and session link
        setState('waitingForPeer'); // Set state to wait for connection
    }

    // --- Send File Metadata ---
    function sendFileMetadataViaSignalR(peerId) {
        if (!senderFiles || senderFiles.length === 0 || !peerId || connection.state !== signalR.HubConnectionState.Connected) {
            console.error("Cannot send metadata: Preconditions not met."); return;
        }
        const filesMetadata = senderFiles.map((file, index) => ({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', fileIndex: index }));
        metadataPackage = { files: filesMetadata, totalFiles: senderFiles.length, totalSize: totalSizeOverall };

        console.log(`Sending metadata for ${filesMetadata.length} file(s) to peer ${peerId.substring(0, 6)}`);
        connection.invoke("SendMetadata", sessionId, metadataPackage)
            .then(() => console.log("Metadata sent successfully."))
            .catch(err => {
                console.error("Error sending metadata:", err);
                showAlert("Error sending file details.", "danger");
                resetSenderStateVariables(false);
                setState('waitingForPeer');
            });
    }

    // --- Global Access & Cleanup ---
    window.addEventListener('beforeunload', () => { /* Minimal cleanup */ });
    console.log("Sender script initialized.");
}); // End DOMContentLoaded