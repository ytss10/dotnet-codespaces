using Microsoft.AspNetCore.OpenApi;
using Scalar.AspNetCore;
using BackEnd.Models;
using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
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

// Add CORS for SignalR
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
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
app.UseCors();

// In-memory storage for sessions
var sessions = new ConcurrentDictionary<string, Session>();
var workers = new ConcurrentDictionary<string, List<WorkerStatus>>();

// Seed some initial sessions
SeedSessions();

void SeedSessions()
{
    var sessionNames = new[] { "Data Processing Pipeline", "Analytics Engine", "ETL Workflow", "Model Training", "Batch Processing" };
    
    for (int i = 0; i < 5; i++)
    {
        var sessionId = $"session-{Guid.NewGuid():N}";
        var workerCount = Random.Shared.Next(2, 8);
        
        var session = new Session(
            Id: sessionId,
            Name: sessionNames[i],
            Status: (SessionStatus)Random.Shared.Next(0, 4),
            CreatedAt: DateTime.UtcNow.AddMinutes(-Random.Shared.Next(1, 120)),
            LastActiveAt: DateTime.UtcNow.AddMinutes(-Random.Shared.Next(0, 30)),
            WorkerCount: workerCount,
            Metrics: new SessionMetrics(
                TotalOperations: Random.Shared.Next(100, 10000),
                SuccessfulOperations: Random.Shared.Next(80, 9500),
                FailedOperations: Random.Shared.Next(0, 100),
                AverageDuration: Random.Shared.NextDouble() * 5,
                CpuUsage: Random.Shared.NextDouble() * 100,
                MemoryUsage: Random.Shared.Next(100, 2000) * 1024 * 1024 // MB to bytes
            )
        );
        
        sessions.TryAdd(sessionId, session);
        
        // Create workers for this session
        var workerList = new List<WorkerStatus>();
        for (int j = 0; j < workerCount; j++)
        {
            workerList.Add(new WorkerStatus(
                Id: $"worker-{j + 1}",
                SessionId: sessionId,
                State: (WorkerState)Random.Shared.Next(0, 5),
                StartedAt: DateTime.UtcNow.AddMinutes(-Random.Shared.Next(0, 60)),
                ProcessedItems: Random.Shared.Next(10, 1000),
                ProgressPercentage: Random.Shared.NextDouble() * 100
            ));
        }
        workers.TryAdd(sessionId, workerList);
    }
}

// API Endpoints

app.MapGet("/api/sessions", () =>
{
    return sessions.Values.OrderByDescending(s => s.CreatedAt).ToArray();
})
.WithName("GetSessions")
.WithDescription("Get all orchestration sessions");

app.MapGet("/api/sessions/{id}", (string id) =>
{
    return sessions.TryGetValue(id, out var session) 
        ? Results.Ok(session) 
        : Results.NotFound();
})
.WithName("GetSession")
.WithDescription("Get a specific session by ID");

app.MapGet("/api/sessions/{id}/workers", (string id) =>
{
    return workers.TryGetValue(id, out var workerList) 
        ? Results.Ok(workerList) 
        : Results.Ok(Array.Empty<WorkerStatus>());
})
.WithName("GetSessionWorkers")
.WithDescription("Get workers for a specific session");

app.MapPost("/api/sessions", (CreateSessionRequest request) =>
{
    var sessionId = $"session-{Guid.NewGuid():N}";
    var session = new Session(
        Id: sessionId,
        Name: request.Name,
        Status: SessionStatus.Active,
        CreatedAt: DateTime.UtcNow,
        LastActiveAt: DateTime.UtcNow,
        WorkerCount: request.WorkerCount,
        Metrics: new SessionMetrics(0, 0, 0, 0, 0, 0)
    );
    
    sessions.TryAdd(sessionId, session);
    
    // Create workers
    var workerList = new List<WorkerStatus>();
    for (int i = 0; i < request.WorkerCount; i++)
    {
        workerList.Add(new WorkerStatus(
            Id: $"worker-{i + 1}",
            SessionId: sessionId,
            State: WorkerState.Idle,
            StartedAt: DateTime.UtcNow,
            ProcessedItems: 0,
            ProgressPercentage: 0
        ));
    }
    workers.TryAdd(sessionId, workerList);
    
    return Results.Created($"/api/sessions/{sessionId}", session);
})
.WithName("CreateSession")
.WithDescription("Create a new orchestration session");

app.MapPost("/api/sessions/{id}/command", (string id, SessionCommand command) =>
{
    if (!sessions.TryGetValue(id, out var session))
        return Results.NotFound();
    
    // Update session status based on command
    var newStatus = command.Type switch
    {
        CommandType.Start or CommandType.Resume => SessionStatus.Active,
        CommandType.Pause => SessionStatus.Paused,
        CommandType.Stop => SessionStatus.Completed,
        _ => session.Status
    };
    
    var updatedSession = session with { 
        Status = newStatus,
        LastActiveAt = DateTime.UtcNow
    };
    
    sessions.TryUpdate(id, updatedSession, session);
    
    return Results.Ok(updatedSession);
})
.WithName("ExecuteSessionCommand")
.WithDescription("Execute a command on a session");

app.MapGet("/api/statistics", () =>
{
    var stats = new SystemStatistics(
        TotalSessions: sessions.Count,
        ActiveSessions: sessions.Values.Count(s => s.Status == SessionStatus.Active),
        TotalWorkers: workers.Values.Sum(w => w.Count),
        ActiveWorkers: workers.Values.SelectMany(w => w).Count(w => w.State == WorkerState.Processing),
        TotalOperations: sessions.Values.Sum(s => s.Metrics.TotalOperations),
        SuccessRate: sessions.Values.Average(s => 
            s.Metrics.TotalOperations > 0 
            ? (double)s.Metrics.SuccessfulOperations / s.Metrics.TotalOperations * 100 
            : 0),
        AverageCpuUsage: sessions.Values.Average(s => s.Metrics.CpuUsage),
        TotalMemoryUsage: sessions.Values.Sum(s => s.Metrics.MemoryUsage)
    );
    
    return stats;
})
.WithName("GetStatistics")
.WithDescription("Get overall system statistics");

app.MapDelete("/api/sessions/{id}", (string id) =>
{
    sessions.TryRemove(id, out _);
    workers.TryRemove(id, out _);
    return Results.NoContent();
})
.WithName("DeleteSession")
.WithDescription("Delete a session");

app.Run();

// Request/Response models
record CreateSessionRequest(string Name, int WorkerCount);

record SystemStatistics(
    int TotalSessions,
    int ActiveSessions,
    int TotalWorkers,
    int ActiveWorkers,
    int TotalOperations,
    double SuccessRate,
    double AverageCpuUsage,
    long TotalMemoryUsage
);
