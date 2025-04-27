using Microsoft.AspNetCore.Mvc;
using P2P.Context;
using P2P.Models;
using System.Text.Json;
namespace P2P.Controllers
{
    public class MetaController : Controller
    {
        private readonly ApplicationDbContext _context;
        public MetaController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> CompleteTransfer([FromBody] List<FileData> filesArray)
        {
             List<List<string>> fileTransfered = new List<List<string>>();

            foreach (var file in filesArray)
            {
                if (filesArray == null || file == null || string.IsNullOrEmpty(file.Name) || file.Size <= 0)
                {
                    return BadRequest("Invalid filesArray data.");
                }

                //If File is not empty Make Entry in list
                fileTransfered.Add(new List<string> { file.Size.ToString(), file.Name  });

            }

            int? user_id = HttpContext.Session.GetInt32("user_id");
                                  
            // Process the data (e.g., save to database)
            TransferHistory transferHistory = new TransferHistory
            {
                UserId = user_id, // Replace with actual user ID
                Time = TimeOnly.FromDateTime(DateTime.Now),
                Date = DateOnly.FromDateTime(DateTime.Now),
                FileTransfered = JsonSerializer.Serialize(fileTransfered) 
            };

            Console.WriteLine("File Transfered: " + transferHistory.FileTransfered);

            Console.WriteLine("Deserialize :" + JsonSerializer.Deserialize<List<List<string>>>(transferHistory.FileTransfered));


            _context.TransferHistories.Add(transferHistory);
            await _context.SaveChangesAsync();



            // For demo purposes, return a success message
            return Ok(new { Message = $"filesArray {filesArray[0].Name} with Size {filesArray[0].Size} saved successfully!" });
        }
    }
    
    public class FileData
    {
        public string? Name { get; set; }
        public long Size { get; set; }
    }
}
