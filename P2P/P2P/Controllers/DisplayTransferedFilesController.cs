using Microsoft.AspNetCore.Mvc;
using P2P.Models;
using System.Runtime.CompilerServices;
using P2P.Context;

namespace P2P.Controllers
{
    public class DisplayTransferedFilesController : Controller
    {
        private readonly ApplicationDbContext _context;
        public List<TransferHistory> list = new List<TransferHistory>();
        public List<List<string>> files = new List<List<string>>();

        public DisplayTransferedFilesController(ApplicationDbContext context)
        {
            _context = context;
        }
       

        public IActionResult Index()
        {
           
            int? user_id = HttpContext.Session.GetInt32("user_id");
            if (user_id == null)
            {
                return RedirectToAction("Login", "Account");
            }

            list  = _context.TransferHistories
                                            .Where(th => th.UserId == user_id)
                                            .ToList();


            
            foreach(var item in list)
            {
                Console.WriteLine(item.id);
                Console.WriteLine(item.UserId);
                Console.WriteLine(item.Date);
                Console.WriteLine(item.FileTransfered);
                Console.WriteLine(item.Time);

            }


            return View(list);
        }
    }
}
