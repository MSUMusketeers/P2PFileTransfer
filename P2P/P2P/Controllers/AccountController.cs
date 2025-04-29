using Microsoft.AspNetCore.Mvc;
using P2P.Models;
using P2P.Context;
using System.Diagnostics;
namespace P2P.Controllers
{

    public class AccountController : Controller
    {
        private readonly ApplicationDbContext _context;
        public AccountController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Login(bool? isSender, string? SessionId)
        {

            if (!isSender.HasValue)
            {
                isSender = true;
                SessionId = "";
            }
            ViewData["isSender"] = isSender;
            ViewData["SessionId"] = SessionId;
            return View();
        }

        [HttpPost]
        public IActionResult Login(string Email, string Password,bool isSender,string SessionId)
        {
            var user = _context.Users.FirstOrDefault(u => u.Email == Email && u.Password == Password);
            if (user != null)
            {
                int user_id = user.Id;
                HttpContext.Session.SetInt32("user_id", user_id);
                if (!isSender)
                {
                    return RedirectToAction("Receiver", "Home", new {SessionId=SessionId});
                }
                return RedirectToAction("Index", "Home");
            }
            ViewBag.Message = "Invalid email or password";
            return View();
        }

        [HttpGet]
        public IActionResult Signup(bool? isSender, string? SessionId)
        { 
            ViewData["isSender"] = isSender;
            ViewData["SessionId"] = SessionId;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Signup(string FullName, string Email, string Password,bool isSender,string SessionId)
        {
            Debug.WriteLine(SessionId + " " + isSender);
            if(_context.Users.Any(u=>u.Email == Email) )
            {
                ViewBag.Message = "Email already exists";
                return View();
            }
            var user = new User
            {
                Username = FullName,
                Email = Email,
                Password = Password
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return RedirectToAction("Login", new { isSender = isSender, SessionId = SessionId });
        }
    }
}
