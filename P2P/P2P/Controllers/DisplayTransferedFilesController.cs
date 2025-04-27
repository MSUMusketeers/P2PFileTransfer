using Microsoft.AspNetCore.Mvc;

namespace P2P.Controllers
{
    public class DisplayTransferedFilesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
