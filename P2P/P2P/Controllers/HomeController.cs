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

        public IActionResult Index(string? sessionId = null)
        {
            ViewData["SessionId"] = sessionId;
            return View();
        }

        // This POST action is effectively replaced by the client-side JavaScript
        // handling the form submission and starting the SignalR/WebRTC process.
        /*
        [HttpPost]
        public IActionResult StartSharing(FileViewModel model)
        {
            can be used to store files in db

            return Accepted();
        }
        */

        public IActionResult Receiver(string SessionId,bool? isAnonymous)
        {
            if(isAnonymous == true)
            {
                ViewData["isAnonymous"] = true;
            }
            else
            {
                ViewData["isAnonymous"] = false;
            }
            Debug.WriteLine("SessionId value is " + SessionId);
            ViewData["SessionId"] = SessionId;
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}

