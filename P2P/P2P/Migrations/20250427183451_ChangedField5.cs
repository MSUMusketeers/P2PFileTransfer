using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2P.Migrations
{
    /// <inheritdoc />
    public partial class ChangedField5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileName",
                table: "TransferHistories",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "TransferHistories",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileName",
                table: "TransferHistories");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "TransferHistories");
        }
    }
}
