using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2P.Migrations
{
    /// <inheritdoc />
    public partial class ChangedField6 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "TransferHistories");

            migrationBuilder.RenameColumn(
                name: "FileName",
                table: "TransferHistories",
                newName: "FileTransfered");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "FileTransfered",
                table: "TransferHistories",
                newName: "FileName");

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "TransferHistories",
                type: "INTEGER",
                nullable: true);
        }
    }
}
