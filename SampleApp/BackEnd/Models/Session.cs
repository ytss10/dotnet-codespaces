namespace BackEnd.Models;

public record Session(
    string Id,
    string Name,
    SessionStatus Status,
    DateTime CreatedAt,
    DateTime? LastActiveAt,
    int WorkerCount,
    SessionMetrics Metrics
);

public enum SessionStatus
{
    Active,
    Paused,
    Completed,
    Failed
}

public record SessionMetrics(
    int TotalOperations,
    int SuccessfulOperations,
    int FailedOperations,
    double AverageDuration,
    double CpuUsage,
    long MemoryUsage
);

public record SessionCommand(
    string SessionId,
    CommandType Type,
    string? Parameters
);

public enum CommandType
{
    Start,
    Stop,
    Pause,
    Resume,
    Scale,
    Reset
}

public record WorkerStatus(
    string Id,
    string SessionId,
    WorkerState State,
    DateTime StartedAt,
    int ProcessedItems,
    double ProgressPercentage
);

public enum WorkerState
{
    Idle,
    Processing,
    Paused,
    Completed,
    Error
}
