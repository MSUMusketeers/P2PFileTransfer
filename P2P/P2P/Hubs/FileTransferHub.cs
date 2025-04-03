using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace P2P.Hubs
{
    public class FileTransferHub : Hub
    {
        // Called by a client to send a signal (SDP or ICE candidate)
        public async Task SendSignal(string sessionId, string senderId, string signal)
        {
            // Send the signal to all other clients in the same session (group)
            await Clients.Group(sessionId).SendAsync("ReceiveSignal", signal, senderId);
        }

        // Called when a client wants to join a session
        public async Task JoinSession(string sessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
            // TO SENDER: Optionally, you can notify the group that a new peer has joined 
            await Clients.Group(sessionId).SendAsync("PeerJoined", Context.ConnectionId);
        }

        public async Task SendMetadata(string sessionId, object metadata)
        {   
            // TO RECEIVER
            await Clients.Group(sessionId).SendAsync("ReceiveMetadata", metadata);
        }

        public async Task ApproveTransfer(string sessionId)
        {
            // TO BOTH PEERS
            await Clients.Group(sessionId).SendAsync("TransferApproved");
        }

        //public override async Task OnConnectedAsync()
        //{
        //    // Optionally, if a sessionId is provided via query string, join that group automatically.
        //    var httpContext = Context.GetHttpContext();
        //    var sessionId = httpContext.Request.Query["sessionId"];
        //    if (!string.IsNullOrEmpty(sessionId))
        //    {
        //        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        //    }
        //    await base.OnConnectedAsync();
        //}
    }
}
