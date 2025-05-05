// --- START OF FILE receiver.js ---

document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const progressBar = document.getElementById('recipient-progress-bar');
    const progressPercentage = document.getElementById('recipient-progress-percentage');
    const statsElement = document.getElementById('recipient-transfer-stats');
    const mainStatusElement = document.getElementById('recipient-file');
    const currentFileNameElement = document.getElementById('recipient-file-name'); // Unique ID
    const fileNumberElement = document.getElementById('recipient-file-number');   // Unique ID
    const receiverCancelBtn = document.getElementById('receiver-cancel-btn');
    const modalElement = document.getElementById('fileConfirmModal');
    const modalFilesList = document.getElementById('modal-files-list');
    const modalLabel = document.getElementById('fileConfirmModalLabel');
    const modalAcceptBtn = document.getElementById('modal-accept-btn');
    const modalRejectBtn = document.getElementById('modal-reject-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');


    // Modal related
    let fileModal = null; // Bootstrap Modal instance (initialized below)

    // State Variables
    let receiverState = 'idle'; // idle, connecting, waitingForMetadata, awaitingApproval, negotiating, transferInProgress, transferComplete, transferFailed, senderDisconnected, cancelled

    // WebRTC & SignalR Variables
    let peerConnection = null;
    let dataChannel = null;
    let myConnectionId = null;
    let senderConnectionId = null;
    let sessionId = null;

    // File Reception Variables
    let allFilesMetadata = null;
    let currentFileMetadata = null;
    let currentFileReceivedSize = 0;
    let currentFileIndex = 0;
    let receivedChunks = [];
    let totalReceivedSizeOverall = 0;
    let totalSizeOverall = 0;
    let transferStartTime = null;

    // Initialize SignalR Connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/fileTransferHub")
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // --- UI Initialization and Event Listeners ---

    if (modalElement) {
        fileModal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
        if (modalAcceptBtn) modalAcceptBtn.addEventListener('click', acceptTransfer);
        if (modalRejectBtn) modalRejectBtn.addEventListener('click', rejectTransfer);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', rejectTransfer); // Also reject on 'x'
    } else { console.error("Modal element not found!"); }

    if (receiverCancelBtn) {
        receiverCancelBtn.addEventListener('click', cancelReceiverTransfer);
    }

    // --- State Management & UI Updates ---

    function setState(newState) {
        console.log(`Receiver State Change: ${receiverState} -> ${newState}`);
        receiverState = newState;

        requestAnimationFrame(() => {
            if (!mainStatusElement || !progressBar || !progressPercentage || !statsElement || !currentFileNameElement || !fileNumberElement || !receiverCancelBtn) return;

            receiverCancelBtn.style.display = 'none'; // Default hide
            progressBar.classList.remove('bg-success', 'bg-danger'); // Remove status colors
            progressBar.classList.add('progress-bar-animated', 'bg-warning'); // Default appearance

            switch (newState) {
                case 'idle':
                    mainStatusElement.textContent = 'Initializing...';
                    resetProgressUI();
                    break;
                case 'connecting':
                    mainStatusElement.textContent = 'Connecting...';
                    resetProgressUI();
                    break;
                case 'waitingForMetadata':
                    mainStatusElement.textContent = 'Waiting for file info...';
                    resetProgressUI();
                    break;
                case 'awaitingApproval':
                    mainStatusElement.textContent = 'Awaiting approval...';
                    resetProgressUI();
                    break;
                case 'negotiating':
                    mainStatusElement.textContent = 'Establishing connection...';
                    receiverCancelBtn.style.display = 'block';
                    resetProgressUI();
                    break;
                case 'transferInProgress':
                    mainStatusElement.textContent = 'Downloading...';
                    receiverCancelBtn.style.display = 'block';
                    break; // Keep progress bar as is
                case 'transferComplete':
                    mainStatusElement.textContent = 'Download Complete!';
                    progressBar.classList.remove('progress-bar-animated', 'bg-warning');
                    progressBar.classList.add('bg-success');
                    progressBar.style.width = '100%';
                    progressPercentage.textContent = '100%';
                    statsElement.textContent = `(${formatBytes(totalSizeOverall)} Total)`;
                    currentFileNameElement.textContent = `Downloaded ${allFilesMetadata?.files?.length || 0} file(s).`;
                    fileNumberElement.textContent = '';
                    break;
                case 'transferFailed':
                    mainStatusElement.textContent = 'Download Failed.';
                    progressBar.classList.remove('progress-bar-animated', 'bg-warning');
                    progressBar.classList.add('bg-danger'); // Indicate failure
                    progressPercentage.textContent = 'Failed';
                    // Keep progress where it was? Or set to 100% red? Let's keep it.
                    break;
                case 'cancelled':
                    mainStatusElement.textContent = 'Download Cancelled.';
                    resetProgressUI();
                    break;
                case 'senderDisconnected':
                    mainStatusElement.textContent = 'Sender Disconnected.';
                    progressBar.classList.remove('progress-bar-animated');
                    // Keep progress where it was when disconnect happened
                    break;
                default:
                    mainStatusElement.textContent = 'Unknown Status';
                    resetProgressUI();
            }
        });
    }

    function resetProgressUI() {
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.classList.remove('bg-success', 'bg-danger');
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

    // --- Core Logic: Connection & Approval ---

    function startReceiverConnection() {
        if (connection.state === signalR.HubConnectionState.Connected || connection.state === signalR.HubConnectionState.Connecting) {
            console.log("SignalR connection already active or starting.");
            joinReceiverSession(); return;
        }
        console.log("Starting SignalR connection for receiver...");
        setState('connecting');
        registerSignalREventHandlers();

        connection.start()
            .then(() => {
                myConnectionId = connection.connectionId;
                console.log("SignalR connected:", myConnectionId);
                const urlParams = new URLSearchParams(window.location.search);
                sessionId = urlParams.get("SessionId");
                console.log("Session ID:", sessionId);
                if (!sessionId) {
                    sessionId = urlParams.get("sessionId");
                    if (!sessionId) {
                        console.error("Session ID missing.");
                        showAlert("Invalid link.", "danger", 0);
                        setState('transferFailed'); return;
                    }
                }
                console.log("Session ID:", sessionId);
                joinReceiverSession();
            })
            .catch(err => {
                console.error("SignalR connection error:", err);
                showAlert("Cannot connect. Refresh.", "danger", 0);
                setState('transferFailed');
            });

        connection.onclose((error) => {
            console.error("SignalR connection closed.", error);
            if (receiverState !== 'cancelled' && receiverState !== 'transferComplete' && receiverState !== 'transferFailed' && receiverState !== 'idle') {
                showAlert("Connection lost. Refresh.", "danger", 0);
            }
            resetReceiverStateVariables();
            setState('transferFailed');
        });
    }

    function joinReceiverSession() {
        if (connection.state === signalR.HubConnectionState.Connected && sessionId) {
            connection.invoke("JoinSession", sessionId)
                .then(() => {
                    console.log(`Joined session ${sessionId}.`);
                    setState('waitingForMetadata');
                })
                .catch(err => {
                    console.error(`Error joining session:`, err);
                    showAlert("Error joining session.", "danger", 0);
                    setState('transferFailed');
                });
        } else {
            console.error("Cannot join session - Preconditions not met.");
            setState('transferFailed');
        }
    }

    function showFileConfirmationModal(metadata, sourcePeerId) {
        if (!fileModal || !modalFilesList || !modalLabel) { console.error("Modal elements missing!"); return; }
        if (receiverState !== 'waitingForMetadata') { console.warn(`Metadata in wrong state (${receiverState}).`); return; }
        if (!metadata || !metadata.files || metadata.files.length === 0) { console.error("Invalid metadata."); showAlert("Invalid file info.", "warning"); return; }

        senderConnectionId = sourcePeerId;
        allFilesMetadata = metadata;
        totalSizeOverall = metadata.totalSize || 0;

        modalLabel.textContent = metadata.files.length > 1 ? `Incoming Files` : `Incoming File`;
        modalFilesList.innerHTML = metadata.files.map(file => `
            <div class="border rounded p-3 d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                    <i data-lucide="file" class="opacity-75 flex-shrink-0" style="width: 20px; height: 20px;"></i>
                    <span class="small text-truncate" title="${file.name}">${file.name || 'Unnamed'}</span>
                </div>
                <span class="text-muted smaller flex-shrink-0">(${formatBytes(file.size || 0)})</span>
            </div>`).join('');
        modalFilesList.innerHTML += `<div class="text-muted small mt-3 text-end">Total: ${metadata.files.length} file(s) (${formatBytes(totalSizeOverall)})</div>`;

        if (typeof lucide !== 'undefined') lucide.createIcons({ parent: modalFilesList });

        setState('awaitingApproval');
        fileModal.show();
    }

    function acceptTransfer() {
        if (receiverState !== 'awaitingApproval' || !senderConnectionId) return;
        if (!fileModal) return;

        console.log("Accepting transfer from", senderConnectionId.substring(0, 6));
        fileModal.hide();
        showAlert("Approval sent. Connecting...", "info");
        setState('negotiating');

        connection.invoke("ApproveTransfer", sessionId, senderConnectionId)
            .then(() => {
                console.log("Approval sent.");
                setupWebRTCConnection();
            })
            .catch(err => {
                console.error("Error sending approval:", err);
                showAlert("Failed approval.", "danger");
                resetReceiverStateVariables();
                setState('transferFailed');
            });
    }

    function rejectTransfer() {
        // Can be called from button or modal 'x'
        if (receiverState !== 'awaitingApproval') {
            if (fileModal && fileModal._isShown) fileModal.hide(); // Hide if needed
            console.warn("Reject called in unexpected state:", receiverState);
            return;
        }
        if (!fileModal) return;

        console.log("Rejecting transfer from", senderConnectionId?.substring(0, 6));
        fileModal.hide();
        showAlert("Transfer rejected.", "warning");

        if (senderConnectionId && connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke("RejectTransfer", sessionId, senderConnectionId)
                .catch(err => console.error("Error sending rejection:", err));
        }
        resetReceiverStateVariables();
        setState('waitingForMetadata');
    }

    // --- WebRTC & File Reception ---
    function setupWebRTCConnection() {
        if (peerConnection) { cleanupWebRTC(); } // Cleanup previous first
        if (receiverState !== 'negotiating') { console.warn("WebRTC setup in wrong state:", receiverState); setState('transferFailed'); return; }

        console.log("Setting up WebRTC PeerConnection...");
        try {
            peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            peerConnection.onicecandidate = handleIceCandidate;
            peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange;
            peerConnection.onconnectionstatechange = handleConnectionStateChange;
            peerConnection.ondatachannel = handleDataChannel; // Receiver listens for channel
        } catch (error) { handleWebRTCError("setting up PeerConnection")(error); }
    }

    let writer;
    let writableStream;
    let expectingNewFile = true; // Flag to initialize stream for a new file

    // Set up Service Worker for streamsaver
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/js/sw.js')
            .then(reg => console.log('Service Worker registered:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    }

    function handleDataChannel(event) {
        console.log("Data channel received:", event.channel.label);
        dataChannel = event.channel;
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onmessage = handleDataChannelMessage;
        dataChannel.onopen = handleDataChannelOpen;
        dataChannel.onclose = handleDataChannelClose;
        dataChannel.onerror = handleDataChannelError;

        currentFileIndex = 0;
        if (!allFilesMetadata?.files?.[currentFileIndex]) { handleTransferError("Missing initial file metadata.")(); return; }
        currentFileMetadata = allFilesMetadata.files[currentFileIndex];
        currentFileReceivedSize = 0; receivedChunks = []; totalReceivedSizeOverall = 0; transferStartTime = null;
        console.log(`Ready for file 1: ${currentFileMetadata.name}`);
        // State becomes 'transferInProgress' on first message
    }

    function handleDataChannelMessage(event) {
        if (receiverState === 'cancelled') {
            console.log("Ignoring message, transfer cancelled.");
            return;
        }

        if (receiverState !== 'transferInProgress') {
            setState('transferInProgress');
            if (!transferStartTime) transferStartTime = Date.now();
        }

        if (event.data === 'EOF') {
            console.log(`Received EOF for file: ${currentFileMetadata.name}`);
            if (currentFileReceivedSize !== currentFileMetadata.size) {
                console.warn(`Size mismatch: expected ${currentFileMetadata.size}, got ${currentFileReceivedSize}`);
            }
            finalizeCurrentFile();
            return;
        }

        // Initialize stream for a new file
        if (expectingNewFile) {
            const fileMeta = currentFileMetadata;
            console.log(`Creating download stream for: ${fileMeta.name}`);
            try {
                writableStream = streamSaver.createWriteStream(fileMeta.name, {
                    size: fileMeta.size,
                    writableStrategy: undefined,
                    readableStrategy: undefined
                });
                writer = writableStream.getWriter();
                expectingNewFile = false;
                console.log('Stream and writer initialized successfully');
            } catch (error) {
                console.error('Error initializing stream:', error);
                handleTransferError("Failed to initialize download stream")();
                return;
            }
        }

        const chunk = event.data;
        try {
            writer.write(new Uint8Array(chunk))
                .catch(error => {
                    console.error('Error writing chunk:', error);
                    handleTransferError("Failed to write chunk")();
                });
            console.log(`Wrote chunk of size: ${chunk.byteLength} bytes`);
        } catch (error) {
            console.error('Error during chunk write:', error);
            handleTransferError("Failed to process chunk")();
            return;
        }

        updateRecipientProgress(chunk.byteLength);
    }

    async function finalizeCurrentFile() {
        try {
            await writer.close();
            console.log(`Download saved: ${currentFileMetadata.name}`);
        } catch (e) {
            console.error("Failed closing file stream:", e);
        }

        currentFileIndex++;
        if (currentFileIndex < allFilesMetadata.files.length) {
            currentFileMetadata = allFilesMetadata.files[currentFileIndex];
            currentFileReceivedSize = 0;
            expectingNewFile = true; // Prepare for next file
            console.log(`Ready for next file: ${currentFileMetadata.name}`);
            updateRecipientProgress(0, true, false);
        } else {
            console.log("All files received!");
            updateRecipientProgress(0, true, true);
        }
    }

    // --- Progress Update ---
    function updateRecipientProgress(receivedInChunk, isEndOfFile = false, isEndOfTransfer = false) {
        // Update internal state
        currentFileReceivedSize += receivedInChunk;
        totalReceivedSizeOverall += receivedInChunk;

        // Update UI
        updateRecipientProgressUI(receivedInChunk);

        // Handle completion logic
        if (isEndOfTransfer && receiverState !== 'transferComplete') {
            // Send History Meta Data to Server/Backend
            sendMetaData();
            console.log("Processing transfer completion.");
            setState('transferComplete'); // Set state first
            // Final UI text update handled by setState('transferComplete')
            showAlert(`Transfer complete. ${allFilesMetadata?.files?.length || 0} file(s) received.`, 'success');
            // Channel closure handled by sender or onclose event
        } else if (isEndOfFile) {
            // console.log(`End of file ${currentFileIndex + 1} processed.`); // Index already incremented
        }
    }

    async function sendMetaData() {

        try {
            const response = await fetch('/Meta/CompleteTransfer?isSender=False', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(allFilesMetadata.files)
            });

            if (!response.ok) {
                throw new Error('Failed to send data');
            }

            const result = await response.json();
            console.log(result.message); // Output: "User John Doe with email john.doe@example.com saved successfully!"
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while sending data.');
        }
    }

    // Separated UI update part of progress
    function updateRecipientProgressUI(receivedInChunk) {
        if (!currentFileMetadata || !allFilesMetadata || !progressBar || !progressPercentage || !statsElement || !currentFileNameElement || !fileNumberElement) {
            return; // Cannot update UI if elements or metadata missing
        }

        const overallProgress = totalSizeOverall > 0 ? Math.min(100, (totalReceivedSizeOverall / totalSizeOverall) * 100) : 0;

        requestAnimationFrame(() => {
            progressBar.style.width = `${overallProgress}%`;
            progressPercentage.textContent = `${Math.round(overallProgress)}%`;

            if (receiverState === 'transferInProgress') {
                currentFileNameElement.textContent = currentFileMetadata.name;
                fileNumberElement.textContent = `(${currentFileIndex + 1}/${allFilesMetadata.files.length})`;

                // Speed calculation
                if (totalReceivedSizeOverall > 0) {
                    const currentTime = Date.now();
                    if (!transferStartTime) transferStartTime = currentTime;
                    const elapsedTime = (currentTime - transferStartTime) / 1000;
                    if (elapsedTime > 0.3) {
                        const speed = totalReceivedSizeOverall / (1024 * 1024) / elapsedTime;
                        statsElement.textContent = `(${speed.toFixed(2)} MB/s)`;
                    }
                }
            }
        });
    }

    // --- WebRTC Event Handlers ---
    function handleIceCandidate(event) {
        if (event.candidate && senderConnectionId && connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ ice: event.candidate }))
                .catch(err => console.error("Error sending ICE candidate:", err));
        }
    }

    function handleIceConnectionStateChange() {
        if (!peerConnection) return;
        console.log("Receiver ICE State:", peerConnection.iceConnectionState);
        if ((peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'closed') &&
            (receiverState === 'transferInProgress' || receiverState === 'negotiating')) {
            if (peerConnection.connectionState !== 'closed') showAlert("Connection issue (ICE).", "warning");
            resetReceiverStateVariables(); setState('senderDisconnected');
        }
    }

    function handleConnectionStateChange() {
        if (!peerConnection) return;
        console.log("Receiver PC State:", peerConnection.connectionState);
        if ((peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'closed') &&
            (receiverState === 'transferInProgress' || receiverState === 'negotiating')) {
            showAlert("Connection lost.", "warning");
            resetReceiverStateVariables(); setState('senderDisconnected');
        }
    }

    function handleDataChannelOpen() {
        console.log("Data channel opened."); /* State changes on message */
    }

    function handleDataChannelClose() {
        console.log("Data channel closed.");
        if (receiverState === 'transferInProgress') {
            if (totalReceivedSizeOverall >= totalSizeOverall && totalSizeOverall > 0) {
                console.log("DC closed, but all bytes seem received.");
                updateRecipientProgress(0, true, true); // Mark complete
            } else {
                showAlert("Transfer interrupted.", "warning"); setState('transferFailed');
                resetReceiverStateVariables();
            }
        }
    }

    function handleDataChannelError(errorEvent) {
        const errorMessage = errorEvent.error ? `${errorEvent.error.name}: ${errorEvent.error.message}` : 'Unknown';
        console.error("Data channel error:", errorMessage, errorEvent);
        if (receiverState === 'transferInProgress' || receiverState === 'negotiating') {
            showAlert(`Transfer error: ${errorMessage}`, "danger");
            resetReceiverStateVariables(); setState('transferFailed');
        }
    }

    // --- Central Error Handlers ---
    function handleTransferError(context) {
        return (error) => {
            console.error(`${context}:`, error);
            if (receiverState === 'transferInProgress' || receiverState === 'negotiating') {
                showAlert(`Transfer failed: ${context}.`, "danger");
                resetReceiverStateVariables();
                setState('transferFailed');
            }
        };
    }

    function handleWebRTCError(context) {
        return (error) => {
            console.error(`WebRTC Error (${context}):`, error);
            if (receiverState !== 'idle' && receiverState !== 'cancelled') {
                showAlert(`Connection setup failed (${context}).`, "danger");
                resetReceiverStateVariables();
                setState('transferFailed');
            }
        };
    }

    // --- SignalR Event Handlers ---
    function registerSignalREventHandlers() {
        connection.off("ReceiveMetadata"); connection.off("ReceiveSignal"); connection.off("PeerDisconnected");
        connection.off("SenderBusy"); connection.off("TransferCancelledByPeer");

        connection.on("ReceiveMetadata", (metadata, sourcePeerId) => {
            console.log("Metadata from:", sourcePeerId.substring(0, 6));
            if (receiverState === 'waitingForMetadata' && !senderConnectionId) {
                showFileConfirmationModal(metadata, sourcePeerId);
            } else { console.warn(`Ignoring metadata in state ${receiverState} or sender known.`); }
        });

        connection.on("ReceiveSignal", (signal, sourcePeerId) => {
            if (sourcePeerId === senderConnectionId && (receiverState === 'negotiating' || receiverState === 'transferInProgress')) {
                handleSignalProcessing(signal);
            }
        });

        connection.on("PeerDisconnected", (peerId) => {
            console.log(`Peer ${peerId.substring(0, 6)} disconnected.`);
            if (peerId === senderConnectionId) {
                console.log("Sender disconnected.");
                const previousState = receiverState;
                resetReceiverStateVariables(); // Clears senderConnectionId

                if (previousState === 'transferInProgress' || previousState === 'negotiating') { showAlert("Sender disconnected.", "warning"); setState('senderDisconnected'); }
                else if (previousState === 'awaitingApproval') { showAlert("Sender left.", "warning"); setState('senderDisconnected'); }
                else if (previousState !== 'transferComplete' && previousState !== 'transferFailed' && previousState !== 'cancelled') { /* console.log("Sender left before active interaction."); */ setState('senderDisconnected'); }

                // Go back to waiting unless already finished/failed/cancelled
                if (previousState !== 'transferComplete' && previousState !== 'transferFailed' && previousState !== 'cancelled') {
                    setTimeout(() => { if (receiverState !== 'idle') setState('waitingForMetadata'); }, 2000);
                }
            }
        });

        connection.on("SenderBusy", () => {
            console.warn("Sender is busy.");
            showAlert("Sender busy. Try later.", "warning", 10000);
            resetReceiverStateVariables(); setState('transferFailed');
        });

        connection.on("TransferCancelledByPeer", (peerId) => {
            if (peerId === senderConnectionId) {
                console.log(`Transfer cancelled by sender ${peerId.substring(0, 6)}.`);
                showAlert(`Sender cancelled transfer.`, 'warning');
                setState('cancelled'); resetReceiverStateVariables();
                setTimeout(() => setState('waitingForMetadata'), 2000);
            }
        });
    }

    // --- Signal Processing ---
    function handleSignalProcessing(signal) {
        if (!peerConnection && !signal.includes('"type":"offer"')) { console.warn("Signal received but PC not ready."); return; }
        try {
            const data = JSON.parse(signal);
            if (data.sdp && data.sdp.type === 'offer') {
                console.log("Received SDP Offer.");
                if (!peerConnection) { handleTransferError("Received offer but PC is null!")(); return; }
                if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-remote-offer') { console.warn(`Offer in wrong state: ${peerConnection.signalingState}`); }

                peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                    .then(() => peerConnection.createAnswer())
                    .then(answer => peerConnection.setLocalDescription(answer))
                    .then(() => {
                        if (senderConnectionId && connection.state === signalR.HubConnectionState.Connected && peerConnection?.localDescription) {
                            console.log("Sending answer...");
                            connection.invoke("SendSignal", sessionId, myConnectionId, JSON.stringify({ sdp: peerConnection.localDescription }))
                                .catch(err => console.error("Error sending answer:", err));
                        } else { console.error("Cannot send answer: Preconditions failed."); }
                    })
                    .catch(handleWebRTCError("handling offer/answer"));
            } else if (data.ice) {
                if (peerConnection && peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(data.ice))
                        .catch(err => console.warn("Error adding ICE:", err));
                } else { console.warn("Ignoring ICE: Remote description not set."); }
            } else { console.warn("Unknown signal type:", data); }
        } catch (error) { console.error("Signal parsing error:", error); }
    }

    // --- Utility and Cleanup ---
    function cleanupWebRTC() {
        console.log("Cleaning up receiver WebRTC...");
        if (dataChannel) {
            dataChannel.onmessage = null; dataChannel.onopen = null; dataChannel.onclose = null; dataChannel.onerror = null;
            if (dataChannel.readyState === 'open' || dataChannel.readyState === 'connecting') { try { dataChannel.close(); } catch (e) { /* Ignore */ } }
            dataChannel = null;
        }
        if (peerConnection) {
            peerConnection.ondatachannel = null; peerConnection.onicecandidate = null; peerConnection.oniceconnectionstatechange = null; peerConnection.onconnectionstatechange = null;
            if (peerConnection.connectionState !== 'closed') { try { peerConnection.close(); } catch (e) { /* Ignore */ } }
            peerConnection = null;
        }
        console.log("Receiver WebRTC cleanup complete.");
    }

    // Renamed to avoid conflict with setState
    function resetReceiverStateVariables() {
        console.log(`Resetting receiver vars. Current state: ${receiverState}`);
        cleanupWebRTC();

        allFilesMetadata = null; currentFileMetadata = null; currentFileReceivedSize = 0;
        currentFileIndex = 0; receivedChunks = []; totalReceivedSizeOverall = 0;
        totalSizeOverall = 0; transferStartTime = null; senderConnectionId = null;

        if (fileModal && fileModal._isShown) { try { fileModal.hide(); } catch (e) { /* Ignore */ } }
        resetProgressUI();
        console.log("Receiver state variables reset.");
    }

    function cancelReceiverTransfer() {
        console.log("Receiver initiated cancel.");
        if (receiverState !== 'negotiating' && receiverState !== 'transferInProgress') { console.warn("Cannot cancel in state:", receiverState); return; }
        const peerToNotify = senderConnectionId;
        if (peerToNotify && connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke("NotifyCancel", sessionId, peerToNotify).catch(err => console.error("Cancel notify error:", err));
        }
        showAlert("Download cancelled.", "warning");
        setState('cancelled');
        resetReceiverStateVariables(); // Cleans up WebRTC, vars
        setTimeout(() => setState('waitingForMetadata'), 1500); // Go back to waiting
    }

    // --- Global Access & Initialization ---
    window.addEventListener('beforeunload', () => { /* Minimal */ });
    startReceiverConnection(); // Start automatically
    console.log("Receiver script initialized.");
    if (typeof lucide !== 'undefined') lucide.createIcons();

}); // End DOMContentLoaded