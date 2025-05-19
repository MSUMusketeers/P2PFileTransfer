using Microsoft.AspNetCore.Mvc;
using P2P.Models;
using P2P.Context;
using System.Diagnostics;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
namespace P2P.Controllers
{

    public class AccountController : Controller
    {
        private readonly ApplicationDbContext _context;
        public AccountController(ApplicationDbContext context)
        {
            _context = context;
        }

        public IActionResult GoogleLogin(string returnUrl = "/")
        {
            var properties = new AuthenticationProperties
            {
                RedirectUri = Url.Action("GoogleCallback", "Account", new { returnUrl })
            };
            return Challenge(properties, GoogleDefaults.AuthenticationScheme);
        }

        public async Task<IActionResult> GoogleCallback(string returnUrl = "/")
        {

            var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            if (!result.Succeeded)
            {
                return RedirectToAction("Login");
            }

            var claimsPrincipal = result.Principal;

            var email = claimsPrincipal.FindFirstValue(ClaimTypes.Email);
            var name = claimsPrincipal.FindFirstValue(ClaimTypes.Name);


            var user = _context.Users.FirstOrDefault(u => u.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Username = name,
                    Email = email,
                    Password = "GoogleUser"
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                var user2 = _context.Users.FirstOrDefault(u=> u.Email == email);
                HttpContext.Session.SetInt32("user_id", user2.Id);
            
            }
            else{
                HttpContext.Session.SetInt32("user_id", user.Id);
            }
            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email)
        };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            return RedirectToAction("Index", "Home", new { isAnonymous = false }); ;
        }

        [HttpGet]
        public IActionResult Login(bool? isSender, string? SessionId)
        {

            if (!isSender.HasValue)
            {
                isSender = true;
                SessionId = null;
            }
            if(SessionId!=null){
                isSender = false;
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
                return RedirectToAction("Index", "Home",new {isAnonymous=false});
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
