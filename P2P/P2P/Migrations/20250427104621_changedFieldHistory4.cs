using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2P.Migrations
{
    /// <inheritdoc />
    public partial class changedFieldHistory4 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "Date",
                table: "TransferHistories",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Date",
                table: "TransferHistories");
        }
    }
}
