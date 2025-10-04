using System;
using System.Collections.Concurrent;
using System.Net;
using System.Threading.Tasks;
using System.Linq;

namespace MultiSiteLoader.Core
{
    public class ProxyRotationEngine
    {
        private readonly ConcurrentDictionary<string, ProxyPool> _regionPools;
        private readonly ProxyHealthMonitor _healthMonitor;
        private readonly GeoLocationService _geoService;
        private readonly IProxyProvider[] _providers;

        public ProxyRotationEngine(params IProxyProvider[] providers)
        {
            _regionPools = new ConcurrentDictionary<string, ProxyPool>();
            _healthMonitor = new ProxyHealthMonitor();
            _geoService = new GeoLocationService();
            _providers = providers;
            
            Task.Run(() => InitializeProxyPoolsAsync());
            Task.Run(() => MonitorProxyHealthAsync());
        }

        public async Task<IWebProxy> GetOptimalProxyAsync(string targetUrl, ProxyStrategy strategy = ProxyStrategy.GeoOptimized)
        {
            var targetRegion = await _geoService.GetRegionAsync(targetUrl);
            
            return strategy switch
            {
                ProxyStrategy.GeoOptimized => await GetGeoOptimizedProxyAsync(targetRegion),
                ProxyStrategy.LoadBalanced => await GetLoadBalancedProxyAsync(),
                ProxyStrategy.HighAnonymity => await GetHighAnonymityProxyAsync(),
                ProxyStrategy.Residential => await GetResidentialProxyAsync(targetRegion),
                _ => await GetRandomProxyAsync()
            };
        }

        private async Task<IWebProxy> GetGeoOptimizedProxyAsync(string region)
        {
            if (_regionPools.TryGetValue(region, out var pool))
            {
                var proxy = await pool.GetHealthyProxyAsync();
                if (proxy != null) return proxy;
            }

            // Fallback to nearest region
            var nearestRegion = await _geoService.GetNearestRegionAsync(region);
            if (_regionPools.TryGetValue(nearestRegion, out pool))
            {
                return await pool.GetHealthyProxyAsync();
            }

            return await GetRandomProxyAsync();
        }

        private async Task InitializeProxyPoolsAsync()
        {
            var tasks = _providers.Select(async provider =>
            {
                var proxies = await provider.GetProxiesAsync();
                foreach (var proxy in proxies)
                {
                    var region = await _geoService.GetProxyRegionAsync(proxy);
                    var pool = _regionPools.GetOrAdd(region, r => new ProxyPool(r));
                    pool.AddProxy(proxy);
                }
            });

            await Task.WhenAll(tasks);
        }

        private async Task MonitorProxyHealthAsync()
        {
            while (true)
            {
                foreach (var pool in _regionPools.Values)
                {
                    await pool.ValidateProxiesAsync(_healthMonitor);
                }
                
                await Task.Delay(TimeSpan.FromMinutes(5));
            }
        }
    }

    public class ProxyPool
    {
        private readonly ConcurrentBag<ProxyInfo> _proxies;
        private readonly SemaphoreSlim _semaphore;
        private readonly string _region;
        private long _requestCount;

        public ProxyPool(string region)
        {
            _region = region;
            _proxies = new ConcurrentBag<ProxyInfo>();
            _semaphore = new SemaphoreSlim(1, 1);
        }

        public async Task<IWebProxy> GetHealthyProxyAsync()
        {
            await _semaphore.WaitAsync();
            try
            {
                var healthyProxies = _proxies
                    .Where(p => p.IsHealthy && p.LastUsed < DateTimeOffset.UtcNow.AddSeconds(-5))
                    .OrderBy(p => p.FailureRate)
                    .ThenBy(p => p.ResponseTime)
                    .ToList();

                if (healthyProxies.Any())
                {
                    var selected = healthyProxies.First();
                    selected.LastUsed = DateTimeOffset.UtcNow;
                    Interlocked.Increment(ref _requestCount);
                    return selected.Proxy;
                }

                return null;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task ValidateProxiesAsync(ProxyHealthMonitor monitor)
        {
            var tasks = _proxies.Select(async proxy =>
            {
                var health = await monitor.CheckHealthAsync(proxy);
                proxy.IsHealthy = health.IsHealthy;
                proxy.ResponseTime = health.ResponseTime;
                proxy.FailureRate = health.FailureRate;
            });

            await Task.WhenAll(tasks);
        }
    }

    public enum ProxyStrategy
    {
        GeoOptimized,
        LoadBalanced,
        HighAnonymity,
        Residential,
        Random
    }
}