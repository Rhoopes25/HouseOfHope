using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Data;

public class AuthIdentityDbContext(DbContextOptions<AuthIdentityDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
}
