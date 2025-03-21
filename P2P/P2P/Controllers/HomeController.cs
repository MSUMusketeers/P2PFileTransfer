using System;
using System.Diagnostics;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using P2P.Models;


namespace P2P.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            return View(new FileViewModel());
        }

        [HttpPost]
        public IActionResult StartSharing(FileViewModel model)
        {
            // In a real implementation, this would handle the WebRTC connection setup
            // For demo purposes, we're just generating a random code
            model.IsSharing = true;
            model.ShareCode = "FLOW" + Guid.NewGuid().ToString().Substring(0, 6).ToUpper();
            model.Progress = 0;

            return View("Index", model);
        }

        [HttpPost]
        public IActionResult ResetSharing()
        {
            return RedirectToAction("Index");
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}

