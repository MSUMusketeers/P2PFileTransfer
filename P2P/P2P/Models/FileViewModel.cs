using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;

namespace P2P.Models
{
    public class FileViewModel
    {
        public List<IFormFile> Files { get; set; } = new List<IFormFile>();
        public bool IsSharing { get; set; }
        public string ShareCode { get; set; }
        public int Progress { get; set; }
    }
}

