using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace P2P.Models
{
    public class TransferHistory
    {
        [Key]
        public int id { get; set; }

        public int? UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public TimeOnly Time { get; set; }

        public DateOnly Date { get; set; }

        public List<List<string>> FileTransfered = new List<List<string>>();

    }
}
