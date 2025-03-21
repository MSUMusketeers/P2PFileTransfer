using Microsoft.EntityFrameworkCore;
using P2P.Models;
namespace P2P.Context
{
    public class ApplicationDbContext:DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }
        public DbSet<User> Users { get; set; } = null!;
    }
}
