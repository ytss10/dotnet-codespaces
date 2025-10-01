namespace FrontEnd.Data;

public class WeatherForecast
{
    public DateOnly Date { get; set; }

    public int TemperatureC { get; set; }

    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

    public string? Summary { get; set; }
    
    public int Humidity { get; set; }
    
    public int WindSpeed { get; set; }
    
    public int Pressure { get; set; }
    
    public string Location { get; set; } = string.Empty;
    
    public string WindSpeedMph => $"{WindSpeed} mph";
    
    public string HumidityPercent => $"{Humidity}%";
    
    public string PressureMb => $"{Pressure} mb";
}
