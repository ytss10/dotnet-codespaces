using Microsoft.AspNetCore.OpenApi;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi(options =>
{
    // current workaround for port forwarding in codespaces
    // https://github.com/dotnet/aspnetcore/issues/57332
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Servers = [];
        return Task.CompletedTask;
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

var locations = new[]
{
    "New York", "London", "Tokyo", "Paris", "Sydney", "Berlin", "Toronto", "Mumbai"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 10).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)],
            Random.Shared.Next(30, 95), // Humidity
            Random.Shared.Next(0, 50), // Wind speed
            Random.Shared.Next(990, 1030), // Pressure
            locations[Random.Shared.Next(locations.Length)] // Location
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.MapGet("/weatherforecast/location/{location}", (string location) =>
{
    var forecast = Enumerable.Range(1, 10).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)],
            Random.Shared.Next(30, 95),
            Random.Shared.Next(0, 50),
            Random.Shared.Next(990, 1030),
            location
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecastByLocation");

app.MapGet("/locations", () =>
{
    return locations;
})
.WithName("GetLocations");

app.Run();

internal record WeatherForecast(
    DateOnly Date, 
    int TemperatureC, 
    string? Summary, 
    int Humidity, 
    int WindSpeed, 
    int Pressure,
    string Location)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
    public string WindSpeedMph => $"{WindSpeed} mph";
    public string HumidityPercent => $"{Humidity}%";
    public string PressureMb => $"{Pressure} mb";
}
