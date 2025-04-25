using Microsoft.AspNetCore.SignalR;
using System; // Required for Exception
using System.Collections.Concurrent; // For managing session state if needed
using System.Threading.Tasks;

namespace P2P.Hubs
{
    public class FileTransferHub : Hub
    {
        // Optional: Track active sessions if more complex logic is needed later
        // private static readonly ConcurrentDictionary<string, string> ActiveSenders = new ConcurrentDictionary<string, string>();

        // Called by a client to send a signal (SDP or ICE candidate)
        public async Task SendSignal(string sessionId, string senderId, string signal)
        {
            // Send the signal ONLY to others in the group, not back to the sender
            await Clients.GroupExcept(sessionId, Context.ConnectionId).SendAsync("ReceiveSignal", signal, senderId);
            Console.WriteLine($"Signal sent from {senderId} in session {sessionId}");
        }

        // Called when a client wants to join a session
        public async Task JoinSession(string sessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
            // Store sessionId for disconnect handling
            Context.Items["SessionId"] = sessionId;
            Console.WriteLine($"Client {Context.ConnectionId} joined session {sessionId}");
            // Notify OTHERS in the group that a new peer has joined
            await Clients.GroupExcept(sessionId, Context.ConnectionId).SendAsync("PeerJoined", Context.ConnectionId);
        }

        // Sender sends metadata package (intended for receiver)
        public async Task SendMetadata(string sessionId, object metadata)
        {
            // Send ONLY to others in the group
            await Clients.GroupExcept(sessionId, Context.ConnectionId).SendAsync("ReceiveMetadata", metadata, Context.ConnectionId);
            Console.WriteLine($"Metadata sent by {Context.ConnectionId} for session {sessionId}");
        }

        // Receiver approves the transfer (notify the sender)
        public async Task ApproveTransfer(string sessionId, string senderConnectionId)
        {
            // Notify ONLY the original sender
            await Clients.Client(senderConnectionId).SendAsync("TransferApprovedByPeer", Context.ConnectionId);
            Console.WriteLine($"Transfer approved by {Context.ConnectionId} for sender {senderConnectionId} in session {sessionId}");
            // Optionally notify others they can start negotiation if sender allows multiple, but for 1-to-1 this is better.
        }

        // Receiver rejects the transfer (notify the sender)
        public async Task RejectTransfer(string sessionId, string senderConnectionId)
        {
            // Notify ONLY the original sender
            await Clients.Client(senderConnectionId).SendAsync("TransferRejectedByPeer", Context.ConnectionId);
            Console.WriteLine($"Transfer rejected by {Context.ConnectionId} for sender {senderConnectionId} in session {sessionId}");
        }

        // Notify the other peer that the transfer was cancelled
        public async Task NotifyCancel(string sessionId, string recipientConnectionId)
        {
            // Notify ONLY the specific recipient (or sender if receiver cancelled)
            await Clients.Client(recipientConnectionId).SendAsync("TransferCancelledByPeer", Context.ConnectionId);
            Console.WriteLine($"Transfer cancelled by {Context.ConnectionId}, notifying {recipientConnectionId} in session {sessionId}");
        }

        // Handle client disconnection
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (Context.Items.TryGetValue("SessionId", out var sessionIdObj) && sessionIdObj is string sessionId && !string.IsNullOrEmpty(sessionId))
            {
                Console.WriteLine($"Client {Context.ConnectionId} disconnected from session {sessionId}");
                // Notify all *remaining* members of the group
                await Clients.Group(sessionId).SendAsync("PeerDisconnected", Context.ConnectionId);
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
            }
            else
            {
                Console.WriteLine($"Client {Context.ConnectionId} disconnected (no session info)");
            }

            await base.OnDisconnectedAsync(exception);
        }

        // Optional: Signal that sender is busy
        public async Task SignalBusy(string recipientConnectionId)
        {
            await Clients.Client(recipientConnectionId).SendAsync("SenderBusy");
        }
    }
}