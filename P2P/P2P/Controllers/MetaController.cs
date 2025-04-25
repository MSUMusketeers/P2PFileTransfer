using Microsoft.AspNetCore.Mvc;

namespace P2P.Controllers
{
    public class MetaController : Controller
    {
        [HttpPost]
        public IActionResult CompleteTransfer([FromBody] List<FileData> filesArray)
        {
            Console.WriteLine($"filesArray: {filesArray.Count}");
            foreach (var file in filesArray)
            {
                if (filesArray == null || file == null || string.IsNullOrEmpty(file.Name) || file.Size <= 0)
                {
                    return BadRequest("Invalid filesArray data.");
                }
                Console.WriteLine($"FILESARRAY {file.Name} with Size {file.Size} saved successfully!");
            }
            // Process the data (e.g., save to database)
            // For demo purposes, return a success message
            return Ok(new { Message = $"filesArray {filesArray[0].Name} with Size {filesArray[0].Size} saved successfully!" });
        }
    }
    
    public class FileData
    {
        public string Name { get; set; }
        public long Size { get; set; }
    }
}
