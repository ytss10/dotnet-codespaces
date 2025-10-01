using FrontEnd.Models;

namespace FrontEnd.Services;

public class OrchestrationClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OrchestrationClient> _logger;

    public OrchestrationClient(HttpClient httpClient, ILogger<OrchestrationClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Session[]> GetSessionsAsync()
        => await _httpClient.GetFromJsonAsync<Session[]>("api/sessions") ?? [];

    public async Task<Session?> GetSessionAsync(string id)
        => await _httpClient.GetFromJsonAsync<Session>($"api/sessions/{id}");

    public async Task<WorkerStatus[]> GetSessionWorkersAsync(string sessionId)
        => await _httpClient.GetFromJsonAsync<WorkerStatus[]>($"api/sessions/{sessionId}/workers") ?? [];

    public async Task<SystemStatistics?> GetStatisticsAsync()
        => await _httpClient.GetFromJsonAsync<SystemStatistics>("api/statistics");
}
