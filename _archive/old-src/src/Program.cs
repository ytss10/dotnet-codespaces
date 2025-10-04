using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel for high performance
builder.WebHost.ConfigureKestrel((context, options) =>
{
    options.Limits.MaxConcurrentConnections = 1000000;
    options.Limits.MaxConcurrentUpgradedConnections = 1000000;
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // 100MB
    options.Limits.MinRequestBodyDataRate = null;
    options.Limits.MinResponseDataRate = null;
    
    // HTTP/2 and HTTP/3 support
    options.ListenAnyIP(5000, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2AndHttp3;
        listenOptions.UseHttps();
    });
});

// Add services
builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 102400000; // 100MB
    options.StreamBufferCapacity = 100;
}).AddMessagePackProtocol();

// Add response compression
builder.Services.AddResponseCompression(opts =>
{
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "application/octet-stream" });
    opts.EnableForHttps = true;
});

// Configure rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddSlidingWindowLimiter("sliding-window", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 6;
        opt.PermitLimit = 10000;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 100000;
    });
});

// Add memory cache
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 1000000000; // 1GB
    options.CompactionPercentage = 0.25;
});

// Register custom services
builder.Services.AddSingleton<DistributedLoadBalancer>();
builder.Services.AddSingleton<ProxyRotationEngine>();
builder.Services.AddSingleton<VirtualDomPool>(sp => new VirtualDomPool(10000));
builder.Services.AddSingleton<IConnectionThrottler>(sp => new ConnectionThrottler(1000000));
builder.Services.AddSingleton<IMessageCompressor, BrotliMessageCompressor>();
builder.Services.AddSingleton<ISiteAnalytics, RealtimeSiteAnalytics>();

// Add background services
builder.Services.AddHostedService<MetricsCollectorService>();
builder.Services.AddHostedService<ProxyHealthMonitorService>();

var app = builder.Build();

// Configure pipeline
app.UseResponseCompression();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapControllers();
app.MapHub<WebSocketHub>("/ws/hub");

app.Run();
