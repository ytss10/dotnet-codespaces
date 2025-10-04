using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using System.Threading.Channels;
using System.Reactive.Linq;
using System.Reactive.Subjects;

namespace MultiSiteLoader.Core
{
    public class DistributedLoadBalancer
    {
        private readonly ConcurrentDictionary<string, WorkerPool> _workerPools;
        private readonly Channel<LoadRequest> _requestChannel;
        private readonly Subject<LoadMetrics> _metricsSubject;
        private readonly CircuitBreaker _circuitBreaker;
        
        public DistributedLoadBalancer()
        {
            _workerPools = new ConcurrentDictionary<string, WorkerPool>();
            _requestChannel = Channel.CreateUnbounded<LoadRequest>(new UnboundedChannelOptions
            {
                SingleReader = false,
                SingleWriter = false,
                AllowSynchronousContinuations = true
            });
            _metricsSubject = new Subject<LoadMetrics>();
            _circuitBreaker = new CircuitBreaker(threshold: 0.5, windowSize: TimeSpan.FromSeconds(30));
        }

        public async Task<ILoadResult> DistributeLoadAsync(LoadRequest request)
        {
            if (_circuitBreaker.IsOpen)
            {
                return await FallbackLoadAsync(request);
            }

            try
            {
                var pool = GetOptimalWorkerPool(request);
                var result = await pool.ExecuteAsync(request);
                
                _metricsSubject.OnNext(new LoadMetrics
                {
                    RequestId = request.Id,
                    Latency = result.Latency,
                    PoolId = pool.Id,
                    Timestamp = DateTimeOffset.UtcNow
                });

                _circuitBreaker.RecordSuccess();
                return result;
            }
            catch (Exception ex)
            {
                _circuitBreaker.RecordFailure();
                throw new LoadBalancerException("Failed to distribute load", ex);
            }
        }

        private WorkerPool GetOptimalWorkerPool(LoadRequest request)
        {
            // Advanced selection algorithm using consistent hashing and load metrics
            var hash = ConsistentHash.ComputeHash(request.TargetUrl);
            var poolKey = $"pool_{hash % _workerPools.Count}";
            
            return _workerPools.GetOrAdd(poolKey, k => new WorkerPool(k)
            {
                MaxConcurrency = 10000,
                EnableAutoScaling = true,
                MetricsInterval = TimeSpan.FromSeconds(5)
            });
        }

        private async Task<ILoadResult> FallbackLoadAsync(LoadRequest request)
        {
            // Implement fallback strategy with reduced features
            await Task.Delay(100);
            return new LoadResult { Success = false, IsFallback = true };
        }
    }

    public class CircuitBreaker
    {
        private readonly double _threshold;
        private readonly TimeSpan _windowSize;
        private readonly ConcurrentQueue<(DateTimeOffset time, bool success)> _history;
        private volatile CircuitState _state = CircuitState.Closed;

        public bool IsOpen => _state == CircuitState.Open;

        public CircuitBreaker(double threshold, TimeSpan windowSize)
        {
            _threshold = threshold;
            _windowSize = windowSize;
            _history = new ConcurrentQueue<(DateTimeOffset, bool)>();
        }

        public void RecordSuccess() => Record(true);
        public void RecordFailure() => Record(false);

        private void Record(bool success)
        {
            var now = DateTimeOffset.UtcNow;
            _history.Enqueue((now, success));
            
            // Clean old entries and calculate failure rate
            while (_history.TryPeek(out var oldest) && now - oldest.time > _windowSize)
            {
                _history.TryDequeue(out _);
            }

            var items = _history.ToArray();
            if (items.Length > 0)
            {
                var failureRate = items.Count(i => !i.success) / (double)items.Length;
                _state = failureRate > _threshold ? CircuitState.Open : CircuitState.Closed;
            }
        }
    }

    public enum CircuitState { Closed, Open, HalfOpen }
}
