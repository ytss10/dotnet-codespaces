namespace FrontEnd.Models;

public class Session
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastActiveAt { get; set; }
    public int WorkerCount { get; set; }
    public SessionMetrics Metrics { get; set; } = new();
}

public enum SessionStatus
{
    Active,
    Paused,
    Completed,
    Failed
}

public class SessionMetrics
{
    public int TotalOperations { get; set; }
    public int SuccessfulOperations { get; set; }
    public int FailedOperations { get; set; }
    public double AverageDuration { get; set; }
    public double CpuUsage { get; set; }
    public long MemoryUsage { get; set; }
}

public class WorkerStatus
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public WorkerState State { get; set; }
    public DateTime StartedAt { get; set; }
    public int ProcessedItems { get; set; }
    public double ProgressPercentage { get; set; }
}

public enum WorkerState
{
    Idle,
    Processing,
    Paused,
    Completed,
    Error
}

public class SystemStatistics
{
    public int TotalSessions { get; set; }
    public int ActiveSessions { get; set; }
    public int TotalWorkers { get; set; }
    public int ActiveWorkers { get; set; }
    public int TotalOperations { get; set; }
    public double SuccessRate { get; set; }
    public double AverageCpuUsage { get; set; }
    public long TotalMemoryUsage { get; set; }
}
