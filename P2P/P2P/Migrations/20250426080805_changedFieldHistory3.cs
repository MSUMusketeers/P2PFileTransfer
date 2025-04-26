using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace P2P.Migrations
{
    /// <inheritdoc />
    public partial class changedFieldHistory3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TransferHistories_Users_UserId",
                table: "TransferHistories");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "TransferHistories",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");

            migrationBuilder.AddColumn<TimeOnly>(
                name: "Time",
                table: "TransferHistories",
                type: "TEXT",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.AddForeignKey(
                name: "FK_TransferHistories_Users_UserId",
                table: "TransferHistories",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TransferHistories_Users_UserId",
                table: "TransferHistories");

            migrationBuilder.DropColumn(
                name: "Time",
                table: "TransferHistories");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "TransferHistories",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TransferHistories_Users_UserId",
                table: "TransferHistories",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
