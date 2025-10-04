using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Collections.Concurrent;
using System.Reactive.Subjects;
using System.Reactive.Linq;

namespace MultiSiteLoader.Admin
{
    [Authorize(Policy = "AdminOnly")]
    public class AdminPanelHub : Hub
    {
        private readonly ISystemMonitor _systemMonitor;
        private readonly ILoadBalancerManager _loadBalancerManager;
        private readonly IProxyManager _proxyManager;
        private readonly IConfigurationService _configService;
        private readonly Subject<SystemEvent> _eventStream;
        private static readonly ConcurrentDictionary<string, AdminSession> _sessions = new();

        public AdminPanelHub(
            ISystemMonitor systemMonitor,
            ILoadBalancerManager loadBalancerManager,
            IProxyManager proxyManager,
            IConfigurationService configService)
        {
            _systemMonitor = systemMonitor;
            _loadBalancerManager = loadBalancerManager;
            _proxyManager = proxyManager;
            _configService = configService;
            _eventStream = new Subject<SystemEvent>();
            
            InitializeEventStreams();
        }

        public override async Task OnConnectedAsync()
        {
            var session = new AdminSession
            {
                ConnectionId = Context.ConnectionId,
                ConnectedAt = DateTimeOffset.UtcNow,
                UserId = Context.UserIdentifier
            };
            
            _sessions[Context.ConnectionId] = session;
            
            await Groups.AddToGroupAsync(Context.ConnectionId, "admins");
            await SendInitialState();
            
            // Start real-time monitoring
            _ = Task.Run(() => StreamMetricsAsync(Context.ConnectionId));
            
            await base.OnConnectedAsync();
        }

        private async Task SendInitialState()
        {
            var state = new AdminDashboardState
            {
                SystemMetrics = await _systemMonitor.GetCurrentMetricsAsync(),
                LoadBalancerStatus = await _loadBalancerManager.GetStatusAsync(),
                ProxyPoolStatus = await _proxyManager.GetPoolStatusAsync(),
                Configuration = await _configService.GetCurrentConfigAsync(),
                ActiveSessions = _sessions.Count,
                SystemUptime = _systemMonitor.GetUptime()
            };
            
            await Clients.Caller.SendAsync("InitialState", state);
        }

        private async Task StreamMetricsAsync(string connectionId)
        {
            var subscription = Observable
                .Interval(TimeSpan.FromSeconds(1))
                .SelectMany(async _ => await _systemMonitor.GetRealtimeMetricsAsync())
                .Subscribe(async metrics =>
                {
                    await Clients.Client(connectionId).SendAsync("MetricsUpdate", metrics);
                });

            _sessions[connectionId].MetricsSubscription = subscription;
        }

        // Advanced Control Methods

        public async Task<CommandResult> ScaleWorkerPool(ScaleCommand command)
        {
            try
            {
                var result = await _loadBalancerManager.ScalePoolAsync(
                    command.PoolId,
                    command.TargetSize,
                    command.ScaleStrategy);
                
                await BroadcastEvent(new SystemEvent
                {
                    Type = EventType.PoolScaled,
                    Data = result,
                    Timestamp = DateTimeOffset.UtcNow
                });
                
                return CommandResult.Success(result);
            }
            catch (Exception ex)
            {
                return CommandResult.Failure(ex.Message);
            }
        }

        public async Task<CommandResult> UpdateProxyConfiguration(ProxyConfig config)
        {
            var validation = ValidateProxyConfig(config);
            if (!validation.IsValid)
                return CommandResult.Failure(validation.Errors);

            await _proxyManager.UpdateConfigurationAsync(config);
            await _configService.SaveConfigAsync("proxy", config);
            
            await BroadcastEvent(new SystemEvent
            {
                Type = EventType.ConfigurationUpdated,
                Data = new { Component = "Proxy", Config = config }
            });
            
            return CommandResult.Success();
        }

        public async Task<CommandResult> ExecuteSystemCommand(SystemCommand command)
        {
            if (!IsAuthorizedForCommand(command))
                return CommandResult.Failure("Unauthorized");

            return command.Type switch
            {
                CommandType.RestartServices => await RestartServicesAsync(command.Parameters),
                CommandType.ClearCache => await ClearCacheAsync(command.Parameters),
                CommandType.ForceGarbageCollection => await ForceGCAsync(),
                CommandType.ReloadConfiguration => await ReloadConfigurationAsync(),
                CommandType.EnableMaintenanceMode => await SetMaintenanceModeAsync(true),
                CommandType.DisableMaintenanceMode => await SetMaintenanceModeAsync(false),
                _ => CommandResult.Failure("Unknown command")
            };
        }

        public async Task<PerformanceReport> GeneratePerformanceReport(ReportParameters parameters)
        {
            var report = new PerformanceReport
            {
                Period = parameters.Period,
                Metrics = await _systemMonitor.GetHistoricalMetricsAsync(
                    parameters.StartTime, 
                    parameters.EndTime),
                LoadDistribution = await _loadBalancerManager.GetLoadDistributionAsync(),
                ProxyPerformance = await _proxyManager.GetPerformanceMetricsAsync(),
                ErrorAnalysis = await _systemMonitor.GetErrorAnalysisAsync(parameters.Period)
            };
            
            return report;
        }

        public async Task UpdateSystemSettings(SystemSettings settings)
        {
            // Validate settings
            var validation = await ValidateSystemSettingsAsync(settings);
            if (!validation.IsValid)
            {
                await Clients.Caller.SendAsync("ValidationError", validation.Errors);
                return;
            }

            // Apply settings with hot reload
            await ApplySettingsAsync(settings);
            
            // Notify all admins
            await Clients.Group("admins").SendAsync("SettingsUpdated", settings);
        }

        private async Task ApplySettingsAsync(SystemSettings settings)
        {
            // Apply rate limiting
            if (settings.RateLimiting != null)
            {
                await _configService.UpdateRateLimitingAsync(settings.RateLimiting);
            }

            // Apply caching settings
            if (settings.Caching != null)
            {
                await _configService.UpdateCachingAsync(settings.Caching);
            }

            // Apply performance settings
            if (settings.Performance != null)
            {
                await ApplyPerformanceSettingsAsync(settings.Performance);
            }

            // Save to persistent storage
            await _configService.SaveConfigAsync("system", settings);
        }

        private async Task ApplyPerformanceSettingsAsync(PerformanceSettings settings)
        {
            // Update thread pool
            ThreadPool.SetMinThreads(settings.MinWorkerThreads, settings.MinIOThreads);
            ThreadPool.SetMaxThreads(settings.MaxWorkerThreads, settings.MaxIOThreads);
            
            // Update GC settings
            if (settings.ServerGC)
            {
                GCSettings.LatencyMode = GCLatencyMode.SustainedLowLatency;
            }
            
            // Update connection limits
            await _loadBalancerManager.UpdateLimitsAsync(new LoadBalancerLimits
            {
                MaxConcurrentRequests = settings.MaxConcurrentRequests,
                RequestQueueLimit = settings.RequestQueueLimit,
                RequestTimeout = TimeSpan.FromSeconds(settings.RequestTimeoutSeconds)
            });
        }

        private async Task BroadcastEvent(SystemEvent evt)
        {
            _eventStream.OnNext(evt);
            await Clients.Group("admins").SendAsync("SystemEvent", evt);
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            if (_sessions.TryRemove(Context.ConnectionId, out var session))
            {
                session.MetricsSubscription?.Dispose();
            }
            
            await base.OnDisconnectedAsync(exception);
        }
    }

    public class AdminSession
    {
        public string ConnectionId { get; set; }
        public string UserId { get; set; }
        public DateTimeOffset ConnectedAt { get; set; }
        public IDisposable MetricsSubscription { get; set; }
    }
}
