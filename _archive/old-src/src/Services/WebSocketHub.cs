using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Threading.Channels;
using System.Buffers;
using Microsoft.AspNetCore.SignalR;

namespace MultiSiteLoader.Services
{
    public class WebSocketHub : Hub
    {
        private static readonly ConcurrentDictionary<string, WebSocketConnection> _connections = new();
        private static readonly Channel<WebSocketMessage> _messageChannel = Channel.CreateUnbounded<WebSocketMessage>(
            new UnboundedChannelOptions
            {
                SingleReader = true,
                SingleWriter = false,
                AllowSynchronousContinuations = false
            });

        private readonly IConnectionThrottler _throttler;
        private readonly IMessageCompressor _compressor;
        private readonly ArrayPool<byte> _arrayPool;

        public WebSocketHub(IConnectionThrottler throttler, IMessageCompressor compressor)
        {
            _throttler = throttler;
            _compressor = compressor;
            _arrayPool = ArrayPool<byte>.Shared;

            // Start message processor
            _ = Task.Run(ProcessMessagesAsync);
        }

        public override async Task OnConnectedAsync()
        {
            if (!await _throttler.TryAcquireAsync(Context.ConnectionId))
            {
                Context.Abort();
                return;
            }

            var connection = new WebSocketConnection
            {
                ConnectionId = Context.ConnectionId,
                ConnectedAt = DateTimeOffset.UtcNow,
                ClientIp = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString()
            };

            _connections.TryAdd(Context.ConnectionId, connection);
            
            await Groups.AddToGroupAsync(Context.ConnectionId, "all-sites");
            await Clients.Caller.SendAsync("Connected", new { id = Context.ConnectionId });
            
            await base.OnConnectedAsync();
        }

        public async Task LoadSites(LoadSitesRequest request)
        {
            // Validate request
            if (request.SiteUrls.Count > 1000000)
            {
                await Clients.Caller.SendAsync("Error", "Maximum 1M sites allowed");
                return;
            }

            // Create batches for parallel processing
            var batchSize = 10000;
            var batches = request.SiteUrls.Chunk(batchSize);
            
            var tasks = batches.Select(async batch =>
            {
                var message = new WebSocketMessage
                {
                    Type = MessageType.LoadBatch,
                    ConnectionId = Context.ConnectionId,
                    Payload = batch,
                    Timestamp = DateTimeOffset.UtcNow
                };

                await _messageChannel.Writer.WriteAsync(message);
            });

            await Task.WhenAll(tasks);
        }

        public async Task UpdateProxySettings(ProxySettings settings)
        {
            if (_connections.TryGetValue(Context.ConnectionId, out var connection))
            {
                connection.ProxySettings = settings;
                await Clients.Caller.SendAsync("ProxyUpdated", settings);
            }
        }

        private async Task ProcessMessagesAsync()
        {
            await foreach (var message in _messageChannel.Reader.ReadAllAsync())
            {
                try
                {
                    // Process message with compression
                    var compressed = await _compressor.CompressAsync(message.Payload);
                    
                    // Send to appropriate clients
                    if (message.Type == MessageType.Broadcast)
                    {
                        await Clients.All.SendAsync("SiteUpdate", compressed);
                    }
                    else if (!string.IsNullOrEmpty(message.ConnectionId))
                    {
                        await Clients.Client(message.ConnectionId).SendAsync("SiteUpdate", compressed);
                    }
                }
                catch (Exception ex)
                {
                    // Log error
                    Console.WriteLine($"Error processing message: {ex.Message}");
                }
            }
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            _connections.TryRemove(Context.ConnectionId, out _);
            await _throttler.ReleaseAsync(Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }
    }

    public class ConnectionThrottler : IConnectionThrottler
    {
        private readonly SemaphoreSlim _semaphore;
        private readonly ConcurrentDictionary<string, DateTimeOffset> _connectionTimes;
        private readonly int _maxConnections;

        public ConnectionThrottler(int maxConnections = 1000000)
        {
            _maxConnections = maxConnections;
            _semaphore = new SemaphoreSlim(maxConnections);
            _connectionTimes = new ConcurrentDictionary<string, DateTimeOffset>();
        }

        public async Task<bool> TryAcquireAsync(string connectionId)
        {
            if (await _semaphore.WaitAsync(0))
            {
                _connectionTimes[connectionId] = DateTimeOffset.UtcNow;
                return true;
            }
            return false;
        }

        public Task ReleaseAsync(string connectionId)
        {
            _connectionTimes.TryRemove(connectionId, out _);
            _semaphore.Release();
            return Task.CompletedTask;
        }
    }
}
