using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using P2P.Context;
using Microsoft.EntityFrameworkCore;
using P2P.Hubs;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
namespace P2P.Models
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddAuthentication(options =>
            {
                options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = GoogleDefaults.AuthenticationScheme;
            })
            .AddCookie()
            .AddGoogle(options =>
            {
                options.ClientId = builder.Configuration["Authentication:Google:ClientId"];
                options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
                options.CallbackPath = "/google-login";
            });

            builder.Services.AddSession(options =>
            {
                options.Cookie.HttpOnly = true;
                options.Cookie.IsEssential = true; // Ensure it works with cookie consent policies
            });

            // Add services to the container.
            builder.Services.AddControllersWithViews();
            builder.Services.AddRazorPages();
            builder.Services.AddSession();
     
            builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(builder.Configuration.GetConnectionString("localDb")));
            builder.Services.AddSignalR();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (!app.Environment.IsDevelopment())
            {
                app.UseExceptionHandler("/Home/Error");
                // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
                app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.UseSession();

            app.UseRouting();

            app.UseAuthorization();

            app.MapControllerRoute(
                name: "default",
                pattern: "{controller=Account}/{action=Login}/{id?}");
            app.MapHub<FileTransferHub>("/filetransferhub");

            app.Run();
        }
    }
}
