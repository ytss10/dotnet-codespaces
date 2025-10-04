using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Collections.Generic;
using System.Linq;

namespace MultiSiteLoader.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("sliding-window")]
    public class SiteController : ControllerBase
    {
        private readonly DistributedLoadBalancer _loadBalancer;
        private readonly ProxyRotationEngine _proxyEngine;
        private readonly VirtualDomPool _domPool;
        private readonly ISiteAnalytics _analytics;
        private readonly IMemoryCache _cache;

        public SiteController(
            DistributedLoadBalancer loadBalancer,
            ProxyRotationEngine proxyEngine,
            VirtualDomPool domPool,
            ISiteAnalytics analytics,
            IMemoryCache cache)
        {
            _loadBalancer = loadBalancer;
            _proxyEngine = proxyEngine;
            _domPool = domPool;
            _analytics = analytics;
            _cache = cache;
        }

        [HttpPost("load-batch")]
        public async Task<IActionResult> LoadBatch([FromBody] BatchLoadRequest request)
        {
            if (request.Urls.Count > 1000000)
            {
                return BadRequest("Maximum 1M URLs allowed per batch");
            }

            var batchId = Guid.NewGuid().ToString();
            
            // Start background processing
            _ = Task.Run(async () =>
            {
                await ProcessBatchAsync(batchId, request);
            });

            return Accepted(new { batchId, status = "processing" });
        }

        [HttpGet("batch/{batchId}/status")]
        public async Task<IActionResult> GetBatchStatus(string batchId)
        {
            var status = await _cache.GetOrCreateAsync($"batch_{batchId}", async entry =>
            {
                entry.SetSlidingExpiration(TimeSpan.FromMinutes(5));
                return await _analytics.GetBatchStatusAsync(batchId);
            });

            return Ok(status);
        }

        [HttpPost("proxy/rotate")]
        public async Task<IActionResult> RotateProxy([FromBody] ProxyRotateRequest request)
        {
            var proxy = await _proxyEngine.GetOptimalProxyAsync(
                request.TargetUrl,
                request.Strategy);

            return Ok(new
            {
                proxy = proxy?.ToString(),
                region = await GetProxyRegion(proxy),
                strategy = request.Strategy.ToString()
            });
        }

        [HttpGet("analytics/realtime")]
        public async Task<IActionResult> GetRealtimeAnalytics()
        {
            var analytics = await _analytics.GetRealtimeMetricsAsync();
            
            return Ok(new
            {
                totalSites = analytics.TotalSites,
                activeSites = analytics.ActiveSites,
                throughput = analytics.Throughput,
                avgLatency = analytics.AverageLatency,
                errorRate = analytics.ErrorRate,
                proxyHealth = analytics.ProxyHealth,
                memoryUsage = analytics.MemoryUsage,
                cpuUsage = analytics.CpuUsage
            });
        }

        private async Task ProcessBatchAsync(string batchId, BatchLoadRequest request)
        {
            var parallelOptions = new ParallelOptions
            {
                MaxDegreeOfParallelism = Environment.ProcessorCount * 2
            };

            var tasks = request.Urls.Chunk(1000).Select(async chunk =>
            {
                using var domLease = await _domPool.AcquireAsync();
                
                foreach (var url in chunk)
                {
                    var loadRequest = new LoadRequest
                    {
                        Id = Guid.NewGuid().ToString(),
                        TargetUrl = url,
                        BatchId = batchId,
                        UseProxy = request.UseProxy,
                        ProxyStrategy = request.ProxyStrategy
                    };

                    await _loadBalancer.DistributeLoadAsync(loadRequest);
                }
            });

            await Task.WhenAll(tasks);
            
            // Update batch status
            await _analytics.UpdateBatchStatusAsync(batchId, BatchStatus.Completed);
        }
    }
}