using Microsoft.AspNetCore.Mvc;

namespace P2P.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        public IActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Login(string Email, string Password)
        {
            if (Email == "admin@example.com" && Password == "password")
            {
                return RedirectToAction("Index", "Home"); // Redirect after login
            }
            ViewBag.Message = "Invalid email or password";
            return View();
        }

        [HttpGet]
        public IActionResult Signup()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Signup(string FullName, string Email, string Password)
        {
            return RedirectToAction("Login");
        }
    }
}
