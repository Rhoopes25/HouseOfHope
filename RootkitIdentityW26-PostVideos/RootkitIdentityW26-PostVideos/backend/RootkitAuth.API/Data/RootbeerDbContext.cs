using Microsoft.EntityFrameworkCore;

namespace RootkitAuth.API.Data;

public class RootbeerDbContext : DbContext
{
    public RootbeerDbContext(DbContextOptions<RootbeerDbContext> options) : base(options)
    {
    }

    public DbSet<Rootbeer> Rootbeers => Set<Rootbeer>();
}
